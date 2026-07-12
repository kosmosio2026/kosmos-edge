use anyhow::{bail, Result};
use serde_json::Value;
use tokio::time::{sleep, Duration};
use tracing::{error, info, warn};

use crate::api::client::{ApiClient, DisplayJob, JobResult};
use crate::config::Config;
use crate::protocol::commands::{build_brightness_command, build_insert_line, build_power_command, build_save_command, DisplayLine, DisplayModule};
use crate::protocol::packet::{is_success_response, TYPE_INSERT};
use crate::transport::serial::send_serial;
use crate::transport::tcp::send_tcp;

pub async fn run_worker(config: Config) -> Result<()> {
    let api = ApiClient::new(config.api_base_url.clone(), config.api_token.clone());

    loop {
        match api.fetch_jobs(&config.daemon_id).await {
            Ok(jobs) => {
                for job in jobs {
                    if let Err(err) = handle_job(&api, job).await {
                        error!("display job failed: {:?}", err);
                    }
                }
            }
            Err(err) => {
                warn!("failed to fetch display jobs: {:?}", err);
            }
        }

        sleep(Duration::from_millis(config.poll_interval_ms)).await;
    }
}

async fn handle_job(api: &ApiClient, job: DisplayJob) -> Result<()> {
    info!("handling display job {} type={}", job.id, job.command_type);

    let result = match execute_job(&job).await {
        Ok((packet_hex, response_hex)) => JobResult {
            status: "ACKED",
            packet_hex: Some(packet_hex),
            response_hex,
            error_message: None,
        },
        Err(err) => JobResult {
            status: "FAILED",
            packet_hex: None,
            response_hex: None,
            error_message: Some(err.to_string()),
        },
    };

    api.report_result(&job.id, &result).await?;
    Ok(())
}

async fn execute_job(job: &DisplayJob) -> Result<(String, Option<String>)> {
    match job.command_type.as_str() {
        "PUBLISH" => publish(job).await,
        "TEST" => publish_device_command(job).await,
        "BRIGHTNESS" => publish_device_command(job).await,
        "POWER" => publish_device_command(job).await,
        "SAVE" => publish_device_command(job).await,
        other => bail!("unsupported display command type: {}", other),
    }
}

async fn publish(job: &DisplayJob) -> Result<(String, Option<String>)> {
    let payload = job.payload.as_ref().ok_or_else(|| anyhow::anyhow!("missing payload"))?;
    let lines = extract_lines(payload)?;

    // 현재 구현은 전체 삭제 후 라인별 INSERT 전송.
    // reset_before는 첫 줄에만 적용.
    let mut last_packet_hex = None;
    let mut last_response_hex = None;

    for (idx, line) in lines.iter().enumerate() {
        let packet = build_insert_line(line, idx == 0, false)?;
        let response = send_packet(job, &packet).await?;

        let packet_hex = hex::encode_upper(&packet);
        let response_hex = if response.is_empty() {
            None
        } else {
            Some(hex::encode_upper(&response))
        };

        if !response.is_empty() && !is_success_response(&response, TYPE_INSERT) {
            bail!("display returned failure response: {:?}", response_hex);
        }

        last_packet_hex = Some(packet_hex);
        last_response_hex = response_hex;
    }

    Ok((
        last_packet_hex.unwrap_or_default(),
        last_response_hex,
    ))
}


async fn publish_device_command(job: &DisplayJob) -> Result<(String, Option<String>)> {
    let packets = build_packets_for_job(job)?;

    let mut last_packet_hex = None;
    let mut last_response_hex = None;

    for packet in packets {
        let response = send_packet(job, &packet).await?;

        let packet_hex = hex::encode_upper(&packet);
        let response_hex = if response.is_empty() {
            None
        } else {
            Some(hex::encode_upper(&response))
        };

        last_packet_hex = Some(packet_hex);
        last_response_hex = response_hex;
    }

    Ok((
        last_packet_hex.unwrap_or_default(),
        last_response_hex,
    ))
}

async fn send_packet(job: &DisplayJob, packet: &[u8]) -> Result<Vec<u8>> {
    match job.display_board.transport.as_str() {
        "TCP" => {
            let host = job
                .display_board
                .tcp_host
                .as_deref()
                .ok_or_else(|| anyhow::anyhow!("missing tcpHost"))?;
            let port = job.display_board.tcp_port.unwrap_or(5000);
            send_tcp(host, port, packet).await
        }
        "RS232" | "RS485" => {
            let port_name = job
                .display_board
                .serial_port
                .clone()
                .ok_or_else(|| anyhow::anyhow!("missing serialPort"))?;
            let baud_rate = job.display_board.baud_rate.unwrap_or(9600);
            let data_bits = job.display_board.data_bits.unwrap_or(8) as u8;
            let parity = job
                .display_board
                .parity
                .clone()
                .unwrap_or_else(|| "none".to_string());
            let stop_bits = job.display_board.stop_bits.unwrap_or(1) as u8;
            let read_timeout_ms = job.display_board.read_timeout_ms.unwrap_or(3000) as u64;
            let packet = packet.to_vec();

            tokio::task::spawn_blocking(move || {
                send_serial(
                    &port_name,
                    baud_rate,
                    data_bits,
                    &parity,
                    stop_bits,
                    read_timeout_ms,
                    &packet,
                )
            })
            .await?
        }
        other => bail!("unsupported transport: {}", other),
    }
}

fn extract_lines(payload: &Value) -> Result<Vec<DisplayLine>> {
    let lines = payload
        .get("lines")
        .and_then(|v| v.as_array())
        .ok_or_else(|| anyhow::anyhow!("payload.lines missing"))?;

    let mut result = Vec::new();

    for item in lines {
        let line_no = item.get("lineNo").and_then(|v| v.as_u64()).unwrap_or(1) as u8;
        let text = item
            .get("text")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string();

        let font_size = item.get("fontSize").and_then(|v| v.as_i64()).unwrap_or(1) as i32;
        let effect = item
            .get("effect")
            .and_then(|v| v.as_str())
            .unwrap_or("090009000900")
            .to_string();
        let speed = item.get("speed").and_then(|v| v.as_i64()).unwrap_or(2) as i32;
        let delay = item.get("delay").and_then(|v| v.as_i64()).unwrap_or(5) as i32;
        let color_code = item.get("colorCode").and_then(|v| v.as_i64()).unwrap_or(0) as i32;
        let font_code = item.get("fontCode").and_then(|v| v.as_i64()).unwrap_or(0) as i32;

        let modules = item
            .get("modules")
            .and_then(|v| v.as_array())
            .map(|items| {
                items
                    .iter()
                    .map(|module| DisplayModule {
                        value: module
                            .get("value")
                            .and_then(|v| v.as_str())
                            .unwrap_or("")
                            .to_string(),
                        color_code: module
                            .get("colorCode")
                            .and_then(|v| v.as_i64())
                            .unwrap_or(color_code as i64) as i32,
                        font_code: module
                            .get("fontCode")
                            .and_then(|v| v.as_i64())
                            .unwrap_or(font_code as i64) as i32,
                    })
                    .collect::<Vec<_>>()
            })
            .unwrap_or_default();

        result.push(DisplayLine {
            line_no,
            text,
            font_size,
            effect,
            speed,
            delay,
            color_code,
            font_code,
            modules,
        });
    }

    Ok(result)
}

fn build_packets_for_job(job: &DisplayJob) -> anyhow::Result<Vec<Vec<u8>>> {
    let payload = job
        .payload
        .as_ref()
        .unwrap_or(&serde_json::Value::Null);

    match job.command_type.as_str() {
        "PUBLISH" | "TEST" => {
            let render_payload = payload
                .get("preview")
                .unwrap_or(payload);

            let lines = extract_lines(render_payload)?;
            let mut packets = Vec::new();

            for (idx, line) in lines.iter().enumerate() {
                packets.push(build_insert_line(line, idx == 0, false)?);
            }

            Ok(packets)
        }
        "BRIGHTNESS" => {
            let level = payload
                .get("brightness")
                .and_then(|value| value.as_u64())
                .unwrap_or(10) as u8;

            Ok(vec![build_brightness_command(level)?])
        }
        "POWER" => {
            let power_on = payload
                .get("powerOn")
                .and_then(|value| value.as_bool())
                .unwrap_or(true);

            Ok(vec![build_power_command(power_on)?])
        }
        "SAVE" => Ok(vec![build_save_command()?]),
        other => anyhow::bail!("unsupported display command type: {}", other),
    }
}
