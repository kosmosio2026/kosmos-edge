use serde::Deserialize;
use std::collections::HashMap;

#[derive(Debug, Deserialize, Clone)]
pub struct AppConfig {
    #[serde(rename = "applicationId")]
    pub application_id: String,

    /// Database table name to insert into
    pub table: String,
}

#[derive(Debug, Deserialize, Default)]
pub struct Config {
    /// Key = logical app name in apps.toml
    #[serde(flatten)]
    pub apps: HashMap<String, AppConfig>,
}

impl Config {
    pub fn load(path: &str) -> anyhow::Result<Self> {
        let text = std::fs::read_to_string(path)?;
        let cfg: Config = toml::from_str(&text)?;

        // Optional: validate that no app has empty applicationId or table
        for (key, app) in &cfg.apps {
            if app.application_id.trim().is_empty() {
                anyhow::bail!("apps.toml entry '{key}' has empty applicationId");
            }
            if app.table.trim().is_empty() {
                anyhow::bail!("apps.toml entry '{key}' has empty table name");
            }
        }

        Ok(cfg)
    }

    /// Find an app config by applicationId (LoRaWAN application ID)
    pub fn find_by_app_id(&self, app_id: &str) -> Option<&AppConfig> {
        self.apps.values().find(|a| a.application_id == app_id)
    }
}
