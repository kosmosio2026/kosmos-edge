use anyhow::{anyhow, Result};

//
// DEVICE TYPE ENUM
//

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum DeviceType {
    Sensio,
    KosmosSensor,
    KosmosTracker,
    Unknown(u8),
}

impl DeviceType {
    pub fn from_u8(v: u8) -> Self {
        match v {
            0x02 => DeviceType::Sensio,
            0x03 => DeviceType::KosmosSensor,
            0x04 => DeviceType::KosmosTracker,
            other => DeviceType::Unknown(other),
        }
    }
}

//
// UNIFIED PARSED PACKET ENUM
//

#[derive(Debug)]
pub enum ParsedPacket {
    SensioEnv(SensioEnvData),
    KosmosSensor(KosmosSensorData),
    KosmosTracker(KosmosTrackerData),
}

//
// SENSIO PACKET
//

#[derive(Debug)]
pub struct SensioEnvData {
    pub temperature_c: f64,
    pub humidity_percent: u8,
    pub pm1_0_ug_m3: f64,
    pub pm2_5_ug_m3: f64,
    pub pm10_ug_m3: f64,
    pub battery_state: u8,
    pub comm_env_ok: bool,
    pub device_ok: bool,
    pub sensor_ok: bool,
}

pub fn parse_sensio_env(buf: &[u8]) -> Result<SensioEnvData> {
    if buf.len() != 13 {
        return Err(anyhow!("Sensio packet must be 13 bytes"));
    }

    if buf[0] != 0x02 {
        return Err(anyhow!("Not a Sensio packet"));
    }

    if buf[1] != 13 {
        return Err(anyhow!("Invalid Sensio length"));
    }

    if buf[2] != 0x01 {
        return Err(anyhow!("Unsupported Sensio CMD"));
    }

    let temp_raw = i16::from_le_bytes([buf[3], buf[4]]);
    let temperature_c = temp_raw as f64 / 100.0;

    let humidity_percent = buf[5];

    let pm1_raw = u16::from_le_bytes([buf[6], buf[7]]);
    let pm2_5_raw = u16::from_le_bytes([buf[8], buf[9]]);
    let pm10_raw = u16::from_le_bytes([buf[10], buf[11]]);

    Ok(SensioEnvData {
        temperature_c,
        humidity_percent,
        pm1_0_ug_m3: pm1_raw as f64 / 10.0,
        pm2_5_ug_m3: pm2_5_raw as f64 / 10.0,
        pm10_ug_m3: pm10_raw as f64 / 10.0,
        battery_state: buf[12] & 0x03,
        comm_env_ok: true,
        device_ok: (buf[12] & 0x04) == 0,
        sensor_ok: (buf[12] & 0x08) == 0,
    })
}

//
// KOSMOS PARKING SENSOR
//

#[derive(Debug)]
pub enum BatteryStatus {
    NearEnd,
    Voltage(f32),
    Unknown,
}

#[derive(Debug)]
pub enum DeviceStatus {
    Ok,
    FunctionError,
    Reserved(u8),
}

#[derive(Debug)]
pub enum ParkingStatus {
    ExitNormal,
    EntryNormal,
    ExitObstacleError,
    EntryObstacleError,
    Reserved(u8),
    Unknown,
}

#[derive(Debug)]
pub struct KosmosSensorData {
    pub battery_status: BatteryStatus,
    pub device_status: DeviceStatus,
    pub parking_status: ParkingStatus,
    pub firmware_version: u8,
}

pub fn parse_kosmos_sensor_packet(buf: &[u8]) -> Result<KosmosSensorData> {
    if buf.len() != 7 {
        return Err(anyhow!("KOSMOS sensor packet must be 7 bytes"));
    }

    if buf[0] != 0x03 {
        return Err(anyhow!("Not a KOSMOS sensor packet"));
    }

    let length = buf[1] as usize;
    if length != buf.len() {
        return Err(anyhow!("Length mismatch"));
    }

    if buf[2] != 0x01 {
        return Err(anyhow!("Unsupported CMD"));
    }

    let data1 = buf[3];
    let data2 = buf[4];
    let data3 = buf[5];
    let checksum = buf[6];

    let expected_checksum: u8 = buf[..6].iter().copied().sum();
    if expected_checksum != checksum {
        return Err(anyhow!("Checksum mismatch"));
    }

    let battery_raw = data1 & 0x0F;
    let battery_status = match battery_raw {
        0 => BatteryStatus::NearEnd,
        1..=0xE => BatteryStatus::Voltage(3.0 + (battery_raw as f32 * 0.1)),
        _ => BatteryStatus::Unknown,
    };

    let device_raw = (data1 >> 4) & 0x0F;
    let device_status = match device_raw {
        0 => DeviceStatus::Ok,
        1 => DeviceStatus::FunctionError,
        v => DeviceStatus::Reserved(v),
    };

    let parking_status = match data2 {
        0 => ParkingStatus::ExitNormal,
        1 => ParkingStatus::EntryNormal,
        2 => ParkingStatus::ExitObstacleError,
        3 => ParkingStatus::EntryObstacleError,
        0xFF => ParkingStatus::Unknown,
        v => ParkingStatus::Reserved(v),
    };

    Ok(KosmosSensorData {
        battery_status,
        device_status,
        parking_status,
        firmware_version: data3,
    })
}

//
// KOSMOS TRACKER PACKET
//

#[derive(Debug)]
pub struct KosmosTrackerData {
    pub battery_status: BatteryStatus,
    pub device_status: DeviceStatus,
    pub latitude_deg: f64,
    pub longitude_deg: f64,
    pub sensor_info: u8,
    pub firmware_version: u8,
    pub battery_voltage: Option<f32>,
}

pub fn parse_kosmos_tracker_packet(buf: &[u8]) -> Result<KosmosTrackerData> {
    if buf.len() < 15 {
        return Err(anyhow!("Tracker packet too short"));
    }

    if buf[0] != 0x04 {
        return Err(anyhow!("Not a tracker packet"));
    }

    let length = buf[1] as usize;
    if length != buf.len() {
        return Err(anyhow!("Length mismatch"));
    }

    let data1 = buf[3];

    let battery_raw = data1 & 0x0F;
    let device_raw = (data1 >> 4) & 0x0F;

    let battery_status = match battery_raw {
        0 => BatteryStatus::NearEnd,
        1..=0xE => BatteryStatus::Voltage(3.0 + (battery_raw as f32 * 0.1)),
        _ => BatteryStatus::Unknown,
    };

    let device_status = match device_raw {
        0 => DeviceStatus::Ok,
        1 => DeviceStatus::FunctionError,
        v => DeviceStatus::Reserved(v),
    };

    let lat_raw = i32::from_le_bytes([buf[4], buf[5], buf[6], buf[7]]);
    let lon_raw = i32::from_le_bytes([buf[8], buf[9], buf[10], buf[11]]);

    let sensor_info = buf[12];
    let firmware_version = buf[13];

    let checksum = buf[14];
    let expected_checksum: u8 = buf[..length - 1].iter().copied().sum();
    if expected_checksum != checksum {
        return Err(anyhow!("Checksum mismatch"));
    }

    let battery_voltage = match battery_status {
        BatteryStatus::Voltage(v) => Some(v),
        _ => None,
    };

    Ok(KosmosTrackerData {
        battery_status,
        device_status,
        latitude_deg: lat_raw as f64 / 1_000_000.0,
        longitude_deg: lon_raw as f64 / 1_000_000.0,
        sensor_info,
        firmware_version,
        battery_voltage,
    })
}

//
// UNIFIED PACKET DISPATCHER
//

pub fn parse_packet(buf: &[u8]) -> Result<ParsedPacket> {
    if buf.len() == 13 && buf[0] == 0x02 {
        return Ok(ParsedPacket::SensioEnv(parse_sensio_env(buf)?));
    }

    if buf.len() == 7 && buf[0] == 0x03 {
        return Ok(ParsedPacket::KosmosSensor(parse_kosmos_sensor_packet(buf)?));
    }

    match DeviceType::from_u8(buf[0]) {
        DeviceType::KosmosTracker => {
            Ok(ParsedPacket::KosmosTracker(parse_kosmos_tracker_packet(buf)?))
        }
        other => Err(anyhow!("Unknown device type: {:?}", other)),
    }
}
