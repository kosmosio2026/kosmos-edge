use anyhow::Result;
use rumqttc::{AsyncClient, Event, Incoming, MqttOptions, QoS};
use std::env;
use std::time::Duration;

use crate::handler::handle_payload;

pub async fn run() -> Result<()> {
    let host = env::var("MQTT_HOST").unwrap_or_else(|_| "localhost".to_string());
    let port = env::var("MQTT_PORT")
        .ok()
        .and_then(|v| v.parse::<u16>().ok())
        .unwrap_or(1883);

    let topic = env::var("MQTT_TOPIC").unwrap_or_else(|_| "chirpstack/+/event/+".to_string());

    let mut mqttoptions = MqttOptions::new("parking-device-daemon", host, port);
    mqttoptions.set_keep_alive(Duration::from_secs(30));

    let (client, mut eventloop) = AsyncClient::new(mqttoptions, 10);
    client.subscribe(topic, QoS::AtLeastOnce).await?;

    println!("Rust daemon subscribed to MQTT");

    loop {
        let event = eventloop.poll().await?;

        if let Event::Incoming(Incoming::Publish(publish)) = event {
            let topic = publish.topic.clone();
            let payload = String::from_utf8_lossy(&publish.payload).to_string();
            if let Err(error) = handle_payload(&topic, &payload).await {
                eprintln!("payload handle error: {:?}", error);
            }
        }
    }
}