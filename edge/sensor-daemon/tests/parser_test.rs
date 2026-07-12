use base64::engine::general_purpose::STANDARD as BASE64;
use sensor_daemon::proto;

#[test]
fn test_sensio_parser() {
    // Example: header + body (fake but structurally valid)
    // header: [0x02, version=1, length=10]
    // body: temp=250 (25.0C), hum=50, pm1=10, pm2.5=20, pm10=30, flags=0b00011101
    let bytes: [u8; 13] = [
        0x02, 0x01, 0x0A,
        0x00, 0xFA, // 250
        50,        // humidity
        0x00, 0x0A,
        0x00, 0x14,
        0x00, 0x1E,
        0b0001_1101,
    ];

    let (header, body) = proto::parse_header(&bytes).unwrap();
    assert!(matches!(header.device_type, proto::DeviceType::Sensio));

    let data = proto::parse_sensio_env(&header, body).unwrap();
    assert_eq!(data.temperature_c, 25.0);
    assert_eq!(data.humidity_percent, 50);
    assert_eq!(data.pm1_0_ug_m3, 10.0);
    assert_eq!(data.pm2_5_ug_m3, 20.0);
    assert_eq!(data.pm10_ug_m3, 30.0);
    assert!(data.comm_env_ok);
    assert!(data.device_ok);
    assert!(data.sensor_ok);
}

#[test]
fn test_kosmos_sensor_parser() {
    // [type=0x03, battery=1, device=0, parking=2, ...]
    let bytes: [u8; 4] = [0x03, 0x01, 0x00, 0x02];
    let data = proto::parse_kosmos_sensor_packet(&bytes).unwrap();

    match data.battery_status {
        proto::BatteryStatus::NearEnd => {}
        _ => panic!("unexpected battery status"),
    }

    match data.device_status {
        proto::DeviceStatus::Ok => {}
        _ => panic!("unexpected device status"),
    }

    match data.parking_status {
        proto::ParkingStatus::ExitObstacleError => {}
        _ => panic!("unexpected parking status"),
    }
}

#[test]
fn test_kosmos_tracker_parser() {
    // [type=0x04, battery=0, device=0, lat=37.123456, lon=127.987654]
    let lat_raw = (37.123456_f64 * 1_000_000.0) as i32;
    let lon_raw = (127.987654_f64 * 1_000_000.0) as i32;

    let mut bytes = Vec::new();
    bytes.push(0x04);
    bytes.push(0x00); // battery normal
    bytes.push(0x00); // device ok
    bytes.extend_from_slice(&lat_raw.to_be_bytes());
    bytes.extend_from_slice(&lon_raw.to_be_bytes());

    let data = proto::parse_kosmos_tracker_packet(&bytes).unwrap();
    assert!((data.latitude_deg - 37.123456).abs() < 0.000001);
    assert!((data.longitude_deg - 127.987654).abs() < 0.000001);
}
