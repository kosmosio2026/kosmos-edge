use crate::proto;
use chrono::{DateTime, Utc};
use serde_json::json;
use sqlx::PgPool;

//
// SENSIO ENVIRONMENTAL SENSOR
//
pub async fn insert_sensio(
    dev_eui: &str,
    gateway_id: &str,
    time: DateTime<Utc>,
    dr: i32,
    fcnt: i32,
    fport: i32,
    rssi: i32,
    snr: f64,
    channel: i32,
    data: &proto::SensioEnvData,
    pool: &PgPool,
) -> Result<(), String> {
    sqlx::query!(
        r#"
        INSERT INTO sensio_env_data
            (dev_eui, gateway_id, time, dr, fcnt, fport,
             rssi, snr, channel,
             temperature_c, humidity_percent,
             pm1_0_ug_m3, pm2_5_ug_m3, pm10_ug_m3,
             battery_state, comm_env_ok, device_ok, sensor_ok)
        VALUES
            ($1,$2,$3,$4,$5,$6,
             $7,$8,$9,
             $10,$11,
             $12,$13,$14,
             $15,$16,$17,$18)
        "#,
        dev_eui,
        gateway_id,
        time.naive_utc(),
        dr,
        fcnt,
        fport,
        rssi,
        snr,
        channel,
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
    .execute(pool)
    .await
    .map_err(|e| format!("DB error (sensio_env_data): {e}"))?;

    Ok(())
}

async fn notify_parking_session_api(
    dev_eui: &str,
    parking_status: i32,
    device_status: i32,
    battery_status: i32,
    battery_voltage: Option<f32>,
    firmware_version: i32,
    gateway_id: &str,
    rssi: i32,
    snr: f64,
    channel: i32,
    dr: i32,
    fcnt: i32,
    fport: i32,
    occurred_at: DateTime<Utc>,
) {
    let api_url = std::env::var("PARKING_API_SENSOR_EVENT_URL")
        .unwrap_or_else(|_| "http://127.0.0.1:3000/api/devices/sensor-events".to_string());

    let payload = json!({
        "eventType": "parking.sensor.status",
        "payload": {
            "devEui": dev_eui,
            "parkingStatus": parking_status,
            "deviceStatus": device_status,
            "batteryStatus": battery_status,
            "batteryVoltage": battery_voltage,
            "firmwareVersion": firmware_version,
            "gatewayId": gateway_id,
            "rssi": rssi,
            "snr": snr,
            "channel": channel,
            "dr": dr,
            "fCnt": fcnt,
            "fPort": fport,
            "occurredAt": occurred_at.to_rfc3339()
        }
    });

    match reqwest::Client::new()
        .post(&api_url)
        .json(&payload)
        .send()
        .await
    {
        Ok(res) => {
            println!(
                "[parking-session-api] notified dev_eui={} parking_status={} status={}",
                dev_eui,
                parking_status,
                res.status()
            );
        }
        Err(err) => {
            eprintln!(
                "[parking-session-api] failed dev_eui={} error={}",
                dev_eui, err
            );
        }
    }
}

//
// KOSMOS PARKING SENSOR
//
pub async fn insert_parking_sensor(
    dev_eui: &str,
    gateway_id: &str,
    time: DateTime<Utc>,
    dr: i32,
    fcnt: i32,
    fport: i32,
    rssi: i32,
    snr: f64,
    channel: i32,
    data: &proto::KosmosSensorData,
    pool: &PgPool,
) -> Result<(), String> {
    let (battery_status_int, battery_voltage_opt): (i32, Option<f32>) = match data.battery_status {
        proto::BatteryStatus::NearEnd => (0, Some(2.9)),
        proto::BatteryStatus::Voltage(v) => {
            let raw = (((v - 3.0) / 0.1).round() as i32).clamp(1, 14);
            (raw, Some(v))
        }
        proto::BatteryStatus::Unknown => (15, None),
    };

    let device_code = match data.device_status {
        proto::DeviceStatus::Ok => 0,
        proto::DeviceStatus::FunctionError => 1,
        proto::DeviceStatus::Reserved(v) => v as i32,
    };

    let parking_code = match data.parking_status {
        proto::ParkingStatus::ExitNormal => 0,
        proto::ParkingStatus::EntryNormal => 1,
        proto::ParkingStatus::ExitObstacleError => 2,
        proto::ParkingStatus::EntryObstacleError => 3,
        proto::ParkingStatus::Reserved(v) => v as i32,
        proto::ParkingStatus::Unknown => 255,
    };

    let next_battery_voltage = battery_voltage_opt.map(|v| v as f64);

    let prev_history = sqlx::query!(
        r#"
        SELECT
            gateway_id,
            battery_status,
            battery_voltage,
            device_status,
            parking_status,
            firmware_version
        FROM parking_sensor_data
        WHERE lower(dev_eui) = lower($1)
        ORDER BY time DESC
        LIMIT 1
        "#,
        dev_eui
    )
    .fetch_optional(pool)
    .await
    .map_err(|e| format!("DB error (select latest parking_sensor_data): {e}"))?;

    let should_record_history = match &prev_history {
        None => true,
        Some(prev) => {
            let battery_voltage_changed = match (prev.battery_voltage, next_battery_voltage) {
                (None, None) => false,
                (Some(_), None) | (None, Some(_)) => true,
                (Some(old), Some(new)) => (old - new).abs() >= 0.05,
            };

            prev.parking_status != parking_code
                || prev.device_status != device_code
                || prev.battery_status != battery_status_int
                || prev.firmware_version != data.firmware_version as i32
                || prev.gateway_id.as_str() != gateway_id
                || battery_voltage_changed
        }
    };

    let prev_state = sqlx::query!(
        r#"
        SELECT parking_status, state_since
        FROM parking_state
        WHERE lower(dev_eui) = lower($1)
        "#,
        dev_eui
    )
    .fetch_optional(pool)
    .await
    .map_err(|e| format!("DB error (select parking_state): {e}"))?;

    let new_state_since = match prev_state {
        Some(row) if row.parking_status == parking_code => row.state_since,
        _ => time.naive_utc(),
    };

    sqlx::query!(
        r#"
        INSERT INTO parking_state
            (dev_eui, parking_status, state_since, last_message_time,
             rssi, snr, battery_voltage)
        VALUES ($1,$2,$3,$4,$5,$6,$7)
        ON CONFLICT (dev_eui)
        DO UPDATE SET
            parking_status = EXCLUDED.parking_status,
            state_since = EXCLUDED.state_since,
            last_message_time = EXCLUDED.last_message_time,
            rssi = EXCLUDED.rssi,
            snr = EXCLUDED.snr,
            battery_voltage = EXCLUDED.battery_voltage
        "#,
        dev_eui,
        parking_code,
        new_state_since,
        time.naive_utc(),
        rssi,
        snr,
        next_battery_voltage,
    )
    .execute(pool)
    .await
    .map_err(|e| format!("DB error (upsert parking_state): {e}"))?;

    if should_record_history {
        let insert_result = sqlx::query!(
            r#"
            INSERT INTO parking_sensor_data
                (dev_eui, gateway_id, time, dr, fcnt, fport,
                 rssi, snr, channel,
                 battery_status, battery_voltage,
                 device_status, parking_status, firmware_version)
            VALUES
                ($1,$2,$3,$4,$5,$6,
                 $7,$8,$9,
                 $10,$11,
                 $12,$13,$14)
            "#,
            dev_eui,
            gateway_id,
            time.naive_utc(),
            dr,
            fcnt,
            fport,
            rssi,
            snr,
            channel,
            battery_status_int,
            next_battery_voltage,
            device_code,
            parking_code,
            data.firmware_version as i32,
        )
        .execute(pool)
        .await
        .map_err(|e| format!("DB error (parking_sensor_data): {e}"))?;

        if insert_result.rows_affected() > 0 {
            notify_parking_session_api(
                dev_eui,
                parking_code,
                device_code,
                battery_status_int,
                battery_voltage_opt,
                data.firmware_version as i32,
                gateway_id,
                rssi,
                snr,
                channel,
                dr,
                fcnt,
                fport,
                time,
            )
            .await;
        }
    }

    Ok(())
}

//
// KOSMOS TRACKER
//
pub async fn insert_kosmos_tracker(
    dev_eui: &str,
    gateway_id: &str,
    time: DateTime<Utc>,
    dr: i32,
    fcnt: i32,
    fport: i32,
    rssi: i32,
    snr: f64,
    channel: i32,
    data: &proto::KosmosTrackerData,
    pool: &PgPool,
) -> Result<(), String> {
    let (battery_status_int, battery_voltage_opt): (i32, Option<f32>) = match data.battery_status {
        proto::BatteryStatus::NearEnd => (0, Some(2.9)),
        proto::BatteryStatus::Voltage(v) => {
            let raw = (((v - 3.0) / 0.1).round() as i32).clamp(1, 14);
            (raw, Some(v))
        }
        proto::BatteryStatus::Unknown => (15, None),
    };

    let device_code = match data.device_status {
        proto::DeviceStatus::Ok => 0,
        proto::DeviceStatus::FunctionError => 1,
        proto::DeviceStatus::Reserved(v) => v as i32,
    };

    sqlx::query!(
        r#"
        INSERT INTO kosmos_tracker_data
            (dev_eui, gateway_id, time, dr, fcnt, fport,
             rssi, snr, channel,
             battery_status, battery_voltage,
             device_status,
             latitude_deg, longitude_deg,
             sensor_info, firmware_version)
        VALUES
            ($1,$2,$3,$4,$5,$6,
             $7,$8,$9,
             $10,$11,
             $12,
             $13,$14,
             $15,$16)
        "#,
        dev_eui,
        gateway_id,
        time.naive_utc(),
        dr,
        fcnt,
        fport,
        rssi,
        snr,
        channel,
        battery_status_int,
        battery_voltage_opt.map(|v| v as f64),
        device_code,
        data.latitude_deg,
        data.longitude_deg,
        data.sensor_info as i32,
        data.firmware_version as i32,
    )
    .execute(pool)
    .await
    .map_err(|e| format!("DB error (kosmos_tracker_data): {e}"))?;

    Ok(())
}
