use anyhow::Result;
use reqwest::Client;
use serde::{Deserialize, Serialize};
use serde_json::Value;

#[derive(Debug, Deserialize)]
pub struct DisplayJob {
    pub id: String,
    #[serde(rename = "displayBoardId")]
    pub display_board_id: String,
    #[serde(rename = "type")]
    pub command_type: String,
    pub payload: Option<Value>,
    #[serde(rename = "displayBoard")]
    pub display_board: DisplayBoard,
}

#[derive(Debug, Deserialize)]
pub struct DisplayBoard {
    pub id: String,
    pub transport: String,

    #[serde(rename = "tcpHost")]
    pub tcp_host: Option<String>,

    #[serde(rename = "tcpPort")]
    pub tcp_port: Option<u16>,

    #[serde(rename = "serialPort")]
    pub serial_port: Option<String>,

    #[serde(rename = "baudRate")]
    pub baud_rate: Option<u32>,

    #[serde(rename = "dataBits")]
    pub data_bits: Option<u32>,

    pub parity: Option<String>,

    #[serde(rename = "stopBits")]
    pub stop_bits: Option<u32>,

    #[serde(rename = "connectTimeoutMs")]
    pub connect_timeout_ms: Option<u32>,

    #[serde(rename = "readTimeoutMs")]
    pub read_timeout_ms: Option<u32>,
}

#[derive(Debug, Serialize)]
pub struct JobResult<'a> {
    pub status: &'a str,
    #[serde(rename = "packetHex")]
    pub packet_hex: Option<String>,
    #[serde(rename = "responseHex")]
    pub response_hex: Option<String>,
    #[serde(rename = "errorMessage")]
    pub error_message: Option<String>,
}

#[derive(Clone)]
pub struct ApiClient {
    client: Client,
    base_url: String,
    token: Option<String>,
}

impl ApiClient {
    pub fn new(base_url: String, token: Option<String>) -> Self {
        Self {
            client: Client::new(),
            base_url,
            token,
        }
    }

    pub async fn fetch_jobs(&self, daemon_id: &str) -> Result<Vec<DisplayJob>> {
        let url = format!("{}/display/daemon/jobs?daemonId={}", self.base_url, daemon_id);
        let mut req = self.client.get(url);

        if let Some(token) = &self.token {
            req = req.bearer_auth(token);
        }

        let res = req.send().await?.error_for_status()?;
        Ok(res.json::<Vec<DisplayJob>>().await?)
    }

    pub async fn report_result(&self, job_id: &str, result: &JobResult<'_>) -> Result<()> {
        let url = format!("{}/display/daemon/jobs/{}/result", self.base_url, job_id);
        let mut req = self.client.post(url).json(result);

        if let Some(token) = &self.token {
            req = req.bearer_auth(token);
        }

        req.send().await?.error_for_status()?;
        Ok(())
    }
}
