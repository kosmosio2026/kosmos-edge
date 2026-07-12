use anyhow::{bail, Result};

pub const STX: u8 = 0x02;
pub const ETX: u8 = 0x03;

pub const TYPE_INSERT: u8 = 0x84;
pub const TYPE_MODIFY: u8 = 0x8A;
pub const TYPE_DELETE: u8 = 0x85;
pub const TYPE_POWER: u8 = 0x86;
pub const TYPE_BRIGHTNESS: u8 = 0x89;
pub const TYPE_SAVE: u8 = 0xE0;

pub fn build_packet(packet_type: u8, data: &[u8]) -> Result<Vec<u8>> {
    if data.len() > 1024 {
        bail!("display packet data too large: {}", data.len());
    }

    let len = data.len() as u16;
    let len_le = len.to_le_bytes();

    let mut checksum: u8 = 0;
    checksum = checksum.wrapping_add(STX);
    checksum = checksum.wrapping_add(packet_type);
    checksum = checksum.wrapping_add(len_le[0]);
    checksum = checksum.wrapping_add(len_le[1]);

    for byte in data {
        checksum = checksum.wrapping_add(*byte);
    }

    let mut packet = Vec::with_capacity(1 + 1 + 2 + data.len() + 1 + 1);
    packet.push(STX);
    packet.push(packet_type);
    packet.extend_from_slice(&len_le);
    packet.extend_from_slice(data);
    packet.push(checksum);
    packet.push(ETX);

    Ok(packet)
}

pub fn is_success_response(packet: &[u8], expected_type: u8) -> bool {
    packet.len() >= 7
        && packet[0] == STX
        && packet[1] == expected_type
        && packet[4] == 0x01
        && packet[packet.len() - 1] == ETX
}
