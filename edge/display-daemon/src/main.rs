mod api;
mod config;
mod protocol;
mod transport;
mod worker;

use anyhow::Result;
use config::Config;
use tracing::info;

#[tokio::main]
async fn main() -> Result<()> {
    dotenvy::dotenv().ok();

    tracing_subscriber::fmt()
        .with_env_filter(
            std::env::var("RUST_LOG").unwrap_or_else(|_| "info".to_string()),
        )
        .init();

    let config = Config::from_env()?;

    info!("starting display-daemon id={}", config.daemon_id);
    info!("api base url={}", config.api_base_url);

    worker::run_worker(config).await
}
