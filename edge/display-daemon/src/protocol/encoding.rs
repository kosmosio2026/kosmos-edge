pub fn encode_utf16le(value: &str) -> Vec<u8> {
    value
        .encode_utf16()
        .flat_map(|code| code.to_le_bytes())
        .collect()
}
