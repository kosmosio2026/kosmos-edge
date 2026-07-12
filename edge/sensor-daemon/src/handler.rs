use anyhow::Result;
use chrono::Utc;
use redis::AsyncCommands;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::env;

#[derive(Debug, Serialize, Deserialize)]
struct DeviceEnvelope {
    topic: String,
    received_at: String,
    payload: Value,
}

pub async fn handle_payload(topic: &str, raw_payload: &str) -> Result<()> {
    let redis_url = env::var("REDIS_URL").unwrap_or_else(|_| "redis://127.0.0.1:6379".to_string());
    let client = redis::Client::open(redis_url)?;
    let mut conn = client.get_multiplexed_async_connection().await?;

    let parsed_payload: Value =
        serde_json::from_str(raw_payload).unwrap_or_else(|_| json!({ "raw": raw_payload }));

    let envelope = DeviceEnvelope {
        topic: topic.to_string(),
        received_at: Utc::now().to_rfc3339(),
        payload: parsed_payload,
    };

    let body = serde_json::to_string(&envelope)?;
    let _: () = conn.xadd("parking:sensor-stream", "*", &[("data", body)]).await?;

    println!("sensor event pushed to redis stream");
    Ok(())
}