use anyhow::{bail, Result};
use serialport::{DataBits, Parity, StopBits};
use std::io::{Read, Write};
use std::time::Duration;

pub fn send_serial(
    port_name: &str,
    baud_rate: u32,
    data_bits: u8,
    parity: &str,
    stop_bits: u8,
    read_timeout_ms: u64,
    packet: &[u8],
) -> Result<Vec<u8>> {
    let data_bits = match data_bits {
        5 => DataBits::Five,
        6 => DataBits::Six,
        7 => DataBits::Seven,
        8 => DataBits::Eight,
        other => bail!("unsupported dataBits: {}", other),
    };

    let parity = match parity.to_ascii_lowercase().as_str() {
        "none" | "n" => Parity::None,
        "odd" | "o" => Parity::Odd,
        "even" | "e" => Parity::Even,
        other => bail!("unsupported parity: {}", other),
    };

    let stop_bits = match stop_bits {
        1 => StopBits::One,
        2 => StopBits::Two,
        other => bail!("unsupported stopBits: {}", other),
    };

    let timeout = Duration::from_millis(read_timeout_ms.max(100));

    let mut port = serialport::new(port_name, baud_rate)
        .data_bits(data_bits)
        .parity(parity)
        .stop_bits(stop_bits)
        .timeout(timeout)
        .open()?;

    port.write_all(packet)?;
    port.flush()?;

    let mut buf = vec![0u8; 1024];
    let n = port.read(&mut buf).unwrap_or(0);
    buf.truncate(n);

    Ok(buf)
}
