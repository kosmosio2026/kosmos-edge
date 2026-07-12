use axum::{
    extract::State,
    routing::post,
    Json, Router,
};
use serde::{Deserialize, Serialize};
use tower_http::cors::{Any, CorsLayer};
use tracing::{info, error};
use tracing_subscriber;
use rumqttc::{AsyncClient, MqttOptions, QoS};

#[derive(Clone)]
struct AppState {
    mqtt_client: AsyncClient,
}

#[derive(Deserialize, Debug)]
struct PublishRequest {
    applicationId: String,
    devEui: String,
    dataHex: String,
    fPort: u8,
    confirmed: bool,
}

#[derive(Serialize)]
struct PublishResponse {
    status: String,
    topic: String,
    payload: String,
}

#[tokio::main]
async fn main() {
    tracing_subscriber::fmt().init();

    // MQTT client 설정
    let mut mqttoptions = MqttOptions::new("downlink_publisher", "localhost", 1883);
    mqttoptions.set_keep_alive(std::time::Duration::from_secs(30));

    let (mqtt_client, mut eventloop) = AsyncClient::new(mqttoptions, 10);

    // MQTT eventloop 실행
    tokio::spawn(async move {
        loop {
            let _ = eventloop.poll().await;
        }
    });

    let state = AppState { mqtt_client };

    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any);

    let app = Router::new()
        .route("/publish", post(publish))
        .with_state(state)
        .layer(cors);

    let listener = tokio::net::TcpListener::bind("0.0.0.0:3001")
        .await
        .unwrap();

    info!("MQTT Downlink publisher running on port 3001");

    axum::serve(listener, app).await.unwrap();
}

async fn publish(
    State(state): State<AppState>,
    Json(req): Json<PublishRequest>,
) -> Json<PublishResponse> {

    info!("Received JSON: {:?}", req);

    if req.devEui.trim().is_empty() {
        return Json(PublishResponse {
            status: "ERROR".to_string(),
            topic: "".to_string(),
            payload: "devEui is empty".to_string(),
        });
    }

    if req.dataHex.trim().is_empty() {
        return Json(PublishResponse {
            status: "ERROR".to_string(),
            topic: "".to_string(),
            payload: "dataHex is empty".to_string(),
        });
    }

    // Hex → Base64 변환
    let bytes = match hex::decode(&req.dataHex) {
        Ok(b) => b,
        Err(e) => {
            error!("Invalid hex: {:?}", e);
            return Json(PublishResponse {
                status: "ERROR".to_string(),
                topic: "".to_string(),
                payload: format!("Invalid hex: {}", e),
            });
        }
    };

    let base64_data = base64::encode(bytes);

    // MQTT Topic 생성
    let topic = format!(
        "application/{}/device/{}/command/down",
        req.applicationId,
        req.devEui
    );

    // MQTT로 실제 전송되는 Payload
    let mqtt_payload = serde_json::json!({
        "devEui": req.devEui,
        "confirmed": req.confirmed,
        "fPort": req.fPort,
        "data": base64_data
    })
    .to_string();

    // 웹 페이지에 표시할 Payload (순서 정렬)
    let display_payload = serde_json::json!({
        "devEui": req.devEui,
        "confirmed": req.confirmed,
        "fPort": req.fPort,
        "data": base64_data
    })
    .to_string();

    // MQTT Publish
    let publish_result = state
        .mqtt_client
        .publish(topic.clone(), QoS::AtMostOnce, false, mqtt_payload)
        .await;

    match publish_result {
        Ok(_) => Json(PublishResponse {
            status: "OK".to_string(),
            topic,
            payload: display_payload,
        }),
        Err(e) => Json(PublishResponse {
            status: "ERROR".to_string(),
            topic,
            payload: format!("MQTT publish error: {}", e),
        }),
    }
}
