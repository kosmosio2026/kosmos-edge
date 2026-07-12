use anyhow::Result;

use super::encoding::encode_utf16le;
use super::packet::{build_packet, TYPE_BRIGHTNESS, TYPE_DELETE, TYPE_INSERT, TYPE_POWER, TYPE_SAVE};

#[derive(Debug, Clone)]
pub struct DisplayModule {
    pub value: String,
    pub color_code: i32,
    pub font_code: i32,
}

#[derive(Debug, Clone)]
pub struct DisplayLine {
    pub line_no: u8,
    pub text: String,
    pub font_size: i32,
    pub effect: String,
    pub speed: i32,
    pub delay: i32,
    pub color_code: i32,
    pub font_code: i32,
    pub modules: Vec<DisplayModule>,
}

pub fn build_insert_line(line: &DisplayLine, reset_before: bool, event: bool) -> Result<Vec<u8>> {
    let mut parts: Vec<String> = Vec::new();

    if reset_before {
        parts.push("RST=1".to_string());
    }

    if event {
        parts.push("EVT=1".to_string());
    }

    let text = if line.modules.is_empty() {
        format!("$C{:02}$F{:02}{}", line.color_code, line.font_code, line.text)
    } else {
        line.modules
            .iter()
            .map(|module| {
                format!(
                    "$C{:02}$F{:02}{}",
                    module.color_code,
                    module.font_code,
                    module.value
                )
            })
            .collect::<Vec<_>>()
            .join("")
    };

    parts.push(format!("LNE={}", line.line_no));
    parts.push(format!("YSZ={}", line.font_size));
    parts.push(format!("EFF={}", line.effect));
    parts.push(format!("SPD={}", line.speed));
    parts.push(format!("DLY={}", line.delay));
    parts.push("NEN=0".to_string());
    parts.push("FIX=0".to_string());
    parts.push(format!("TXT={}", text));

    let data = parts.join(",");
    let data = encode_utf16le(&data);

    build_packet(TYPE_INSERT, &data)
}

pub fn build_delete_all() -> Result<Vec<u8>> {
    let data = encode_utf16le("IDX=99");
    build_packet(TYPE_DELETE, &data)
}

pub fn build_power(power_on: bool) -> Result<Vec<u8>> {
    let data = encode_utf16le(if power_on { "POW=1" } else { "POW=0" });
    build_packet(TYPE_POWER, &data)
}

pub fn build_brightness(level: u8) -> Result<Vec<u8>> {
    let normalized = level.clamp(1, 10);
    let data = encode_utf16le(&format!("BRT={:02}", normalized));
    build_packet(TYPE_BRIGHTNESS, &data)
}

pub fn build_save() -> Result<Vec<u8>> {
    let data = encode_utf16le("SAV=1");
    build_packet(TYPE_SAVE, &data)
}

pub fn build_brightness_command(level: u8) -> anyhow::Result<Vec<u8>> {
    let safe_level = level.clamp(1, 10);
    let data = encode_utf16le(&format!("BRT={}", safe_level));
    build_packet(TYPE_BRIGHTNESS, &data)
}

pub fn build_power_command(power_on: bool) -> anyhow::Result<Vec<u8>> {
    let data = encode_utf16le(&format!("PWR={}", if power_on { 1 } else { 0 }));
    build_packet(TYPE_POWER, &data)
}

pub fn build_save_command() -> anyhow::Result<Vec<u8>> {
    let data = encode_utf16le("SAVE=1");
    build_packet(TYPE_SAVE, &data)
}
