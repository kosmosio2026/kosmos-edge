use std::collections::HashMap;
use std::time::Duration;

use axum::{
    extract::{
        ws::{Message, WebSocket, WebSocketUpgrade},
        Query, State,
    },
    response::IntoResponse,
    routing::get,
    Json, Router,
};
use chrono::{DateTime, NaiveDateTime, Utc};
use serde::Serialize;
use sqlx::{postgres::PgListener, PgPool};
use tokio::{net::TcpListener, time::sleep};
use tower_http::cors::CorsLayer;
use tracing::{info, warn};

/* ---------------------------------------------------------
   STATE
--------------------------------------------------------- */

#[derive(Clone)]
pub struct WsState {
    pub pool: PgPool,
}

/* ---------------------------------------------------------
   DATA STRUCTURES
--------------------------------------------------------- */

#[derive(Serialize)]
pub struct TrackerRow {
    pub id: i64,
    pub dev_eui: String,
    pub time: NaiveDateTime,
    pub latitude_deg: f64,
    pub longitude_deg: f64,
    pub battery_status: i32,
    pub battery_voltage: Option<f64>,
    pub device_status: i32,
    pub sensor_info: Option<i32>,
    pub firmware_version: Option<i32>,
}

#[derive(Serialize)]
pub struct SensioRow {
    pub time: NaiveDateTime,
    pub temperature_c: f64,
    pub humidity_percent: i32,
    pub pm1_0_ug_m3: f64,
    pub pm2_5_ug_m3: f64,
    pub pm10_ug_m3: f64,
}

#[derive(Serialize)]
pub struct ParkingHistoryRow {
    pub time: NaiveDateTime,
    pub dev_eui: String,
    pub parking_status: i32,
    pub rssi: i32,
    pub snr: f64,
}

#[derive(Serialize)]
pub struct SlotRow {
    pub slot_id: i32,
    pub slot_label: String,
    pub dev_eui: String,
}

#[derive(Serialize)]
pub struct ParkingStateRow {
    pub dev_eui: String,
    pub parking_status: i32,
    pub state_since: NaiveDateTime,
    pub last_message_time: NaiveDateTime,
    pub rssi: Option<i32>,
    pub snr: Option<f64>,
    pub battery_voltage: Option<f64>,
}

/* ---------------------------------------------------------
   TIME HELPER
--------------------------------------------------------- */

fn to_utc_string(dt: NaiveDateTime) -> String {
    DateTime::<Utc>::from_naive_utc_and_offset(dt, Utc).to_rfc3339()
}

/* ---------------------------------------------------------
   REST API (tracker)
--------------------------------------------------------- */

async fn tracker_data_api(State(state): State<WsState>) -> Json<Vec<serde_json::Value>> {
    let rows = sqlx::query_as!(
        TrackerRow,
        r#"
        SELECT id,
               dev_eui,
               created_at AS time,
               latitude_deg,
               longitude_deg,
               battery_status,
               battery_voltage,
               device_status,
               sensor_info,
               firmware_version
        FROM kosmos_tracker_data
        ORDER BY created_at DESC
        LIMIT 500
        "#
    )
    .fetch_all(&state.pool)
    .await
    .unwrap();

    let rows = rows
        .into_iter()
        .map(|r| {
            serde_json::json!({
                "id": r.id,
                "dev_eui": r.dev_eui,
                "time": to_utc_string(r.time),
                "latitude_deg": r.latitude_deg,
                "longitude_deg": r.longitude_deg,
                "battery_status": r.battery_status,
                "battery_voltage": r.battery_voltage,
                "device_status": r.device_status,
                "sensor_info": r.sensor_info,
                "firmware_version": r.firmware_version
            })
        })
        .collect();

    Json(rows)
}

async fn tracker_history_api(
    State(state): State<WsState>,
    Query(params): Query<HashMap<String, String>>,
) -> Json<Vec<serde_json::Value>> {
    let limit = params
        .get("limit")
        .and_then(|v| v.parse::<i64>().ok())
        .unwrap_or(100);
    let page = params
        .get("page")
        .and_then(|v| v.parse::<i64>().ok())
        .unwrap_or(1);
    let offset = (page - 1).max(0) * limit;

    let rows = sqlx::query_as!(
        TrackerRow,
        r#"
        SELECT id,
               dev_eui,
               created_at AS time,
               latitude_deg,
               longitude_deg,
               battery_status,
               battery_voltage,
               device_status,
               sensor_info,
               firmware_version
        FROM kosmos_tracker_data
        ORDER BY created_at DESC
        LIMIT $1 OFFSET $2
        "#,
        limit,
        offset
    )
    .fetch_all(&state.pool)
    .await
    .unwrap();

    let rows = rows
        .into_iter()
        .map(|r| {
            serde_json::json!({
                "id": r.id,
                "dev_eui": r.dev_eui,
                "time": to_utc_string(r.time),
                "latitude_deg": r.latitude_deg,
                "longitude_deg": r.longitude_deg,
                "battery_status": r.battery_status,
                "battery_voltage": r.battery_voltage,
                "device_status": r.device_status,
                "sensor_info": r.sensor_info,
                "firmware_version": r.firmware_version
            })
        })
        .collect();

    Json(rows)
}

/* ---------------------------------------------------------
   MAIN SERVER
--------------------------------------------------------- */

pub async fn run_ws_server(pool: PgPool) -> anyhow::Result<()> {
    let state = WsState { pool };

    let cors = CorsLayer::permissive();

    let api_routes = Router::new()
        .route("/tracker/data", get(tracker_data_api))
        .route("/tracker/history", get(tracker_history_api))
        .layer(cors);

    let ws_routes = Router::new().route("/ws", get(ws_handler));

    let app = Router::new()
        .nest("/api", api_routes)
        .merge(ws_routes)
        .with_state(state);

    let port = std::env::var("SENSOR_DAEMON_WS_PORT")
        .unwrap_or_else(|_| "3006".to_string())
        .parse::<u16>()
        .map_err(|error| anyhow::anyhow!("Invalid SENSOR_DAEMON_WS_PORT: {error}"))?;

    let addr = format!("0.0.0.0:{port}");
    let listener = TcpListener::bind(addr.as_str()).await?;
    info!("WebSocket + API server listening on http://{addr}");

    axum::serve(listener, app).await?;
    Ok(())
}

/* ---------------------------------------------------------
   WEBSOCKET HANDLER
--------------------------------------------------------- */

async fn ws_handler(ws: WebSocketUpgrade, State(state): State<WsState>) -> impl IntoResponse {
    ws.on_upgrade(move |socket| handle_ws(socket, state))
}

async fn handle_ws(mut socket: WebSocket, state: WsState) {
    info!("WebSocket client connected");

    let mut listener = PgListener::connect_with(&state.pool).await.unwrap();

    listener.listen("tracker_update").await.unwrap();
    listener.listen("parking_update").await.unwrap();
    listener.listen("sensio_update").await.unwrap();
    listener.listen("slot_update").await.unwrap();

    sleep(Duration::from_millis(150)).await;

    if let Err(e) = push_all(&mut socket, &state.pool).await {
        warn!("Initial push failed: {e}");
        return;
    }

    loop {
        tokio::select! {
            msg = listener.recv() => {
                match msg {
                    Ok(notification) => {
                        let channel = notification.channel();
                        let res = match channel {
                            "tracker_update" => push_tracker(&mut socket, &state.pool).await,
                            "parking_update" => {
                                if let Err(e) = push_parking_state(&mut socket, &state.pool).await {
                                    Err(e)
                                } else {
                                    push_parking_history(&mut socket, &state.pool).await
                                }
                            }
                            "sensio_update" => push_sensio(&mut socket, &state.pool).await,
                            "slot_update" => push_slots(&mut socket, &state.pool).await,
                            _ => Ok(()),
                        };

                        if let Err(e) = res {
                            warn!("Push error on channel {channel}: {e}");
                            return;
                        }
                    }
                    Err(e) => {
                        warn!("PgListener error: {e}");
                        return;
                    }
                }
            }

            ws_msg = socket.recv() => {
                match ws_msg {
                    Some(Ok(Message::Close(_))) => return,
                    Some(Err(e)) => {
                        warn!("WebSocket error: {e}");
                        return;
                    }
                    None => return,
                    _ => {}
                }
            }
        }
    }
}

/* ---------------------------------------------------------
   PUSH HELPERS
--------------------------------------------------------- */

async fn push_all(socket: &mut WebSocket, pool: &PgPool) -> anyhow::Result<()> {
    push_slots(socket, pool).await?;
    push_parking_state(socket, pool).await?;
    push_parking_history(socket, pool).await?;
    push_sensio(socket, pool).await?;
    push_tracker(socket, pool).await?;
    Ok(())
}

async fn push_tracker(socket: &mut WebSocket, pool: &PgPool) -> anyhow::Result<()> {
    let rows = sqlx::query_as!(
        TrackerRow,
        r#"
        SELECT id,
               dev_eui,
               created_at AS time,
               latitude_deg,
               longitude_deg,
               battery_status,
               battery_voltage,
               device_status,
               sensor_info,
               firmware_version
        FROM kosmos_tracker_data
        ORDER BY created_at DESC
        LIMIT 500
        "#
    )
    .fetch_all(pool)
    .await?;

    let rows = rows
        .into_iter()
        .map(|r| {
            serde_json::json!({
                "id": r.id,
                "dev_eui": r.dev_eui,
                "time": to_utc_string(r.time),
                "latitude_deg": r.latitude_deg,
                "longitude_deg": r.longitude_deg,
                "battery_status": r.battery_status,
                "battery_voltage": r.battery_voltage,
                "device_status": r.device_status,
                "sensor_info": r.sensor_info,
                "firmware_version": r.firmware_version
            })
        })
        .collect::<Vec<_>>();

    socket
        .send(Message::Text(
            serde_json::json!({ "type": "tracker", "rows": rows }).to_string(),
        ))
        .await?;

    Ok(())
}

async fn push_sensio(socket: &mut WebSocket, pool: &PgPool) -> anyhow::Result<()> {
    let rows = sqlx::query_as!(
        SensioRow,
        r#"
        SELECT
            time,
            temperature_c,
            humidity_percent,
            pm1_0_ug_m3,
            pm2_5_ug_m3,
            pm10_ug_m3
        FROM sensio_env_data
        ORDER BY time DESC
        LIMIT 200
        "#
    )
    .fetch_all(pool)
    .await?;

    let rows = rows
        .into_iter()
        .map(|r| {
            serde_json::json!({
                "time": to_utc_string(r.time),
                "temperature_c": r.temperature_c,
                "humidity_percent": r.humidity_percent,
                "pm1_0_ug_m3": r.pm1_0_ug_m3,
                "pm2_5_ug_m3": r.pm2_5_ug_m3,
                "pm10_ug_m3": r.pm10_ug_m3
            })
        })
        .collect::<Vec<_>>();

    socket
        .send(Message::Text(
            serde_json::json!({ "type": "sensio", "rows": rows }).to_string(),
        ))
        .await?;

    Ok(())
}

async fn push_slots(socket: &mut WebSocket, pool: &PgPool) -> anyhow::Result<()> {
    let rows = sqlx::query_as!(
        SlotRow,
        r#"
        SELECT
            slot_id,
            slot_label,
            dev_eui
        FROM slot_mapping
        ORDER BY slot_id
        "#
    )
    .fetch_all(pool)
    .await?;

    socket
        .send(Message::Text(
            serde_json::json!({ "type": "slots", "rows": rows }).to_string(),
        ))
        .await?;

    Ok(())
}

async fn push_parking_state(socket: &mut WebSocket, pool: &PgPool) -> anyhow::Result<()> {
    let rows = sqlx::query_as!(
        ParkingStateRow,
        r#"
        SELECT
            dev_eui,
            parking_status,
            state_since,
            last_message_time,
            rssi,
            snr,
            battery_voltage
        FROM parking_state
        "#
    )
    .fetch_all(pool)
    .await?;

    let rows = rows
        .into_iter()
        .map(|r| {
            serde_json::json!({
                "dev_eui": r.dev_eui,
                "parking_status": r.parking_status,
                "state_since": to_utc_string(r.state_since),
                "last_message_time": to_utc_string(r.last_message_time),
                "rssi": r.rssi,
                "snr": r.snr,
                "battery_voltage": r.battery_voltage
            })
        })
        .collect::<Vec<_>>();

    socket
        .send(Message::Text(
            serde_json::json!({ "type": "parking_state", "rows": rows }).to_string(),
        ))
        .await?;

    Ok(())
}

async fn push_parking_history(socket: &mut WebSocket, pool: &PgPool) -> anyhow::Result<()> {
    let rows = sqlx::query_as!(
        ParkingHistoryRow,
        r#"
        SELECT
            created_at AS time,
            dev_eui,
            parking_status,
            rssi,
            snr
        FROM parking_sensor_data
        ORDER BY created_at DESC
        LIMIT 500
        "#
    )
    .fetch_all(pool)
    .await?;

    let rows = rows
        .into_iter()
        .map(|r| {
            serde_json::json!({
                "time": to_utc_string(r.time),
                "dev_eui": r.dev_eui,
                "parking_status": r.parking_status,
                "rssi": r.rssi,
                "snr": r.snr
            })
        })
        .collect::<Vec<_>>();

    socket
        .send(Message::Text(
            serde_json::json!({ "type": "parking_history", "rows": rows }).to_string(),
        ))
        .await?;

    Ok(())
}
