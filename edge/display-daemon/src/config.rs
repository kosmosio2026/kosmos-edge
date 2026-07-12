use anyhow::Result;
use std::env;

#[derive(Debug, Clone)]
pub struct Config {
    pub daemon_id: String,
    pub api_base_url: String,
    pub api_token: Option<String>,
    pub poll_interval_ms: u64,
}

impl Config {
    pub fn from_env() -> Result<Self> {
        dotenvy::dotenv().ok();

        Ok(Self {
            daemon_id: env::var("DISPLAY_DAEMON_ID")
                .unwrap_or_else(|_| "edge-display-001".to_string()),
            api_base_url: env::var("PARKING_API_BASE_URL")
                .unwrap_or_else(|_| "http://127.0.0.1:3001/api".to_string()),
            api_token: env::var("PARKING_API_TOKEN").ok().filter(|v| !v.is_empty()),
            poll_interval_ms: env::var("POLL_INTERVAL_MS")
                .ok()
                .and_then(|v| v.parse().ok())
                .unwrap_or(2000),
        })
    }
}
