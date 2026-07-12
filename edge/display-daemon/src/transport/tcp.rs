use anyhow::Result;
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::TcpStream;
use tokio::time::{timeout, Duration};

pub async fn send_tcp(host: &str, port: u16, packet: &[u8]) -> Result<Vec<u8>> {
    let addr = format!("{}:{}", host, port);

    let mut stream = timeout(Duration::from_secs(3), TcpStream::connect(addr)).await??;
    stream.write_all(packet).await?;
    stream.flush().await?;

    let mut buf = vec![0u8; 1024];

    let n = timeout(Duration::from_secs(3), stream.read(&mut buf)).await??;
    buf.truncate(n);

    Ok(buf)
}
