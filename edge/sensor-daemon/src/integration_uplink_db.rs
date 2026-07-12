use base64::engine::general_purpose::STANDARD as BASE64;
use sensor_daemon::proto;
use serde::Deserialize;
use sqlx::{PgPool, Executor};

#[derive(Debug, Deserialize)]
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

#[derive(Debug, Deserialize)]
struct DeviceInfo {
    #[serde(default)]
    applicationName: String,
    #[serde(default)]
    applicationId: String,
    #[serde(default)]
    devEui: String,
}

#[derive(Debug, Deserialize)]
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

#[tokio::test]
async fn test_sensio_uplink_inserts_row() -> anyhow::Result<()> {
    dotenvy::dotenv().ok();
    let db_url = std::env::var("DATABASE_URL")?;
    let pool = PgPool::connect(&db_url).await?;

    // Run migrations
    let sql = std::fs::read_to_string("migrations/0001_sensio_env_data.sql")?;
    pool.execute(sql.as_str()).await?;

    let json = r#"
    {
        "time":"2026-01-16T16:28:29.998326412+00:00",
        "deviceInfo":{
            "applicationName":"SENSIO",
            "applicationId":"65027314-5031-4d01-a13d-91005e994e49",
            "devEui":"ac1f09fffe1c7fd1"
        },
        "dr":5,
        "fCnt":12,
        "fPort":2,
        "data":"Ag0BBAo6+gAGAQYBAA==",
        "rxInfo":[{"gatewayId":"ac1f09fffe19bf09","rssi":-46,"snr":11.0,"channel":2}]
    }
    "#;

    let uplink: Uplink = serde_json::from_str(json)?;
    let raw = BASE64.decode(uplink.data.as_bytes())?;

    //
    // NEW unified parsing
    //
    let parsed = proto::parse_packet(&raw)?;

    let data = match parsed {
        proto::ParsedPacket::SensioEnv(d) => d,
        other => panic!("Expected SensioEnv packet, got {:?}", other),
    };

    sqlx::query!(
        r#"
        INSERT INTO sensio_env_data
            (dev_eui, gateway_id, time, dr, fcnt, fport, rssi, snr, channel,
             temperature_c, humidity_percent, pm1_0_ug_m3, pm2_5_ug_m3, pm10_ug_m3,
             battery_state, comm_env_ok, device_ok, sensor_ok)
        VALUES
            ($1,$2,$3,$4,$5,$6,$7,$8,$9,
             $10,$11,$12,$13,$14,
             $15,$16,$17,$18)
        "#,
        uplink.deviceInfo.devEui,
        uplink.rxInfo[0].gatewayId,
        uplink.time,
        uplink.dr,
        uplink.fCnt,
        uplink.fPort,
        uplink.rxInfo[0].rssi,
        uplink.rxInfo[0].snr,
        uplink.rxInfo[0].channel,
        data.temperature_c,
        data.humidity_percent as i32,
        data.pm1_0_ug_m3,
        data.pm2_5_ug_m3,
        data.pm10_ug_m3,
        data.battery_state as i32,
        data.comm_env_ok,
        data.device_ok,
        data.sensor_ok,
    )
    .execute(&pool)
    .await?;

    let row = sqlx::query!("SELECT COUNT(*) as count FROM sensio_env_data")
        .fetch_one(&pool)
        .await?;

    assert!(row.count.unwrap_or(0) > 0);

    Ok(())
}