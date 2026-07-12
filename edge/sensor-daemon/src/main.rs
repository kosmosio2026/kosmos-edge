mod proto;
mod config;
mod db;
mod ws;

use std::{sync::Arc, time::Duration};

use anyhow::Context;
use base64::Engine as _;
use base64::engine::general_purpose::STANDARD as BASE64;
use chrono::{DateTime, Utc};
use rumqttc::{AsyncClient, Event, EventLoop, MqttOptions, Packet, QoS};
use serde::Deserialize;
use sqlx::PgPool;
use tokio::time::sleep;
use tracing::{error, info, warn};

use db::{
    insert_sensio,
    insert_parking_sensor,
    insert_kosmos_tracker,
};

use ws::run_ws_server;

#[allow(non_snake_case)]
#[derive(Debug, Deserialize, Default)]
struct RxInfo {
    #[serde(default)]
    gatewayId: String,
    #[serde(default)]
    rssi: i32,
    #[serde(default)]
    snr: f64,
    #[serde(default)]
    channel: i32,
}

#[allow(non_snake_case)]
#[allow(dead_code)]
#[derive(Debug, Deserialize, Default)]
struct DeviceInfo {
    #[serde(default)]
    tenantId: String,
    #[serde(default)]
    tenantName: String,
    #[serde(default)]
    applicationId: String,
    #[serde(default)]
    applicationName: String,
    #[serde(default)]
    deviceProfileId: String,
    #[serde(default)]
    deviceProfileName: String,
    #[serde(default)]
    deviceName: String,
    #[serde(default)]
    devEui: String,
}

#[allow(non_snake_case)]
#[derive(Debug, Deserialize, Default)]
struct Uplink {
    #[serde(default)]
    time: String,
    #[serde(default)]
    deviceInfo: DeviceInfo,
    #[serde(default)]
    dr: i32,
    #[serde(default)]
    fCnt: i32,
    #[serde(default)]
    fPort: i32,
    #[serde(default)]
    data: String,
    #[serde(default)]
    rxInfo: Vec<RxInfo>,
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    dotenvy::dotenv().ok();
    tracing_subscriber::fmt()
        .with_env_filter(tracing_subscriber::EnvFilter::from_default_env())
        .init();

    let db_url = std::env::var("DATABASE_URL")
        .context("DATABASE_URL must be set")?;
    let pool = PgPool::connect(&db_url)
        .await
        .context("failed to connect to Postgres")?;

    info!("Connected to PostgreSQL");

    let cfg = config::Config::load("apps.toml")
        .expect("Failed to load apps.toml");
    let cfg = Arc::new(cfg);

    // Run MQTT + WebSocket concurrently
    let pool_for_mqtt = pool.clone();
    let cfg_for_mqtt = cfg.clone();

    let mqtt_task = tokio::spawn(async move {
        mqtt_loop(pool_for_mqtt, cfg_for_mqtt).await;
    });

    let ws_task = tokio::spawn(async move {
        run_ws_server(pool).await.unwrap();
    });

    tokio::try_join!(mqtt_task, ws_task)?;

    Ok(())
}

async fn build_mqtt() -> anyhow::Result<(AsyncClient, EventLoop)> {
    let host = std::env::var("MQTT_HOST").unwrap_or_else(|_| "localhost".to_string());
    let port: u16 = std::env::var("MQTT_PORT")
        .unwrap_or_else(|_| "1883".to_string())
        .parse()
        .context("invalid MQTT_PORT")?;

    let mut options = MqttOptions::new("sensor-daemon", host, port);
    options.set_keep_alive(Duration::from_secs(30));

    let use_tls = std::env::var("MQTT_TLS").unwrap_or_else(|_| "false".into()) == "true";
    if use_tls {
        let ca_path = std::env::var("MQTT_CA")?;
        let cert_path = std::env::var("MQTT_CERT")?;
        let key_path = std::env::var("MQTT_KEY")?;

        let ca = std::fs::read(ca_path)?;
        let cert = std::fs::read(cert_path)?;
        let key = std::fs::read(key_path)?;

        let tls = rumqttc::TlsConfiguration::Simple {
            ca,
            client_auth: Some((cert, key)),
            alpn: None,
        };
        options.set_transport(rumqttc::Transport::Tls(tls));
    }

    let (client, eventloop) = AsyncClient::new(options, 10);

    let topic = std::env::var("MQTT_TOPIC")
        .unwrap_or_else(|_| "application/+/device/+/event/up".to_string());

    client.subscribe(topic.clone(), QoS::AtMostOnce).await?;
    info!("Subscribed to MQTT topic: {}", topic);
    info!("Subscribed to application uplinks");

    Ok((client, eventloop))
}

async fn mqtt_loop(pool: PgPool, cfg: Arc<config::Config>) {
    let mut backoff_secs = 1u64;

    loop {
        match build_mqtt().await {
            Ok((_client, mut eventloop)) => {
                info!("Connected to MQTT broker");
                backoff_secs = 1;

                loop {
                    match eventloop.poll().await {
                        Ok(Event::Incoming(Packet::Publish(p))) => {
                            let topic = p.topic.clone();
                            let payload = p.payload.to_vec();
                            let pool_cloned = pool.clone();
                            let cfg_cloned = cfg.clone();

                            tokio::spawn(async move {
                                if let Err(e) = handle_application_uplink(
                                    &topic,
                                    &payload,
                                    &pool_cloned,
                                    &cfg_cloned
                                ).await {
                                    error!("uplink error on topic {}: {}", topic, e);
                                }
                            });
                        }
                        Ok(_) => {}
                        Err(e) => {
                            error!("MQTT error: {e}");
                            break;
                        }
                    }
                }
            }
            Err(e) => error!("MQTT connect error: {e}"),
        }

        warn!("Reconnecting in {} seconds...", backoff_secs);
        sleep(Duration::from_secs(backoff_secs)).await;
        backoff_secs = (backoff_secs * 2).min(60);
    }
}

async fn handle_application_uplink(
    _topic: &str,
    payload: &[u8],
    pool: &PgPool,
    cfg: &config::Config,
) -> Result<(), String> {
    let uplink: Uplink = serde_json::from_slice(payload)
        .map_err(|e| format!("JSON parse error: {e}"))?;

    let app_id = uplink.deviceInfo.applicationId.as_str();

    let _app = match cfg.find_by_app_id(app_id) {
        Some(a) => a,
        None => {
            warn!("Unknown applicationId {}, ignoring uplink", app_id);
            return Ok(());
        }
    };

    let dev_eui = uplink.deviceInfo.devEui.clone();

    let time_parsed: DateTime<Utc> = uplink.time.parse()
        .map_err(|e| format!("invalid time format: {e}"))?;

    let dr = uplink.dr;
    let fcnt = uplink.fCnt;
    let fport = uplink.fPort;

    let (gateway_id, rssi, snr, channel) = uplink
        .rxInfo
        .get(0)
        .map(|rx| (rx.gatewayId.clone(), rx.rssi, rx.snr, rx.channel))
        .unwrap_or_default();

    let raw = BASE64
        .decode(uplink.data.as_bytes())
        .map_err(|e| format!("base64 decode error: {e}"))?;

    let parsed = proto::parse_packet(&raw)
        .map_err(|e| format!("packet parse error: {e}"))?;

    match parsed {
        proto::ParsedPacket::SensioEnv(data) => {
            insert_sensio(
                &dev_eui, &gateway_id, time_parsed, dr, fcnt, fport,
                rssi, snr, channel, &data, pool
            ).await?;
        }

        proto::ParsedPacket::KosmosSensor(data) => {
            insert_parking_sensor(
                &dev_eui, &gateway_id, time_parsed, dr, fcnt, fport,
                rssi, snr, channel, &data, pool
            ).await?;
        }

        proto::ParsedPacket::KosmosTracker(data) => {
            insert_kosmos_tracker(
                &dev_eui, &gateway_id, time_parsed, dr, fcnt, fport,
                rssi, snr, channel, &data, pool
            ).await?;
        }
    }

    Ok(())
}
