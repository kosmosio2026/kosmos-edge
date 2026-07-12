import { Injectable, Logger } from '@nestjs/common';
import * as net from 'net';

@Injectable()
export class TransportService {
  private readonly logger = new Logger(TransportService.name);

  private mode: 'ethernet' | 'serial' | 'rs485' = 'ethernet';

  private ethernet = {
    host: '192.168.5.112',
    port: 5000,
  };

  setMode(mode: 'ethernet' | 'serial' | 'rs485') {
    this.mode = mode;
  }

  async send(packet: Buffer): Promise<any> {
    if (this.mode === 'ethernet') {
      return this.sendEthernet(packet);
    }
    // RS232/RS485는 필요 시 추가
  }

  private sendEthernet(packet: Buffer): Promise<any> {
    return new Promise((resolve, reject) => {
      const socket = new net.Socket();

      socket.connect(this.ethernet.port, this.ethernet.host, () => {
        socket.write(packet);
      });

      socket.on('data', (data) => {
        this.logger.debug(`Response: ${data.toString('hex')}`);
        resolve({ raw: data.toString('hex') });
        socket.destroy();
      });

      socket.on('error', (err) => {
        reject(err);
      });
    });
  }
}
