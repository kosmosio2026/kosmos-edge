import { Injectable } from '@nestjs/common';

@Injectable()
export class PacketBuilderService {
  private readonly STX = 0x02;
  private readonly ETX = 0x03;

  encodeText(text: string): Buffer {
    const buf = Buffer.alloc(text.length * 2);
    for (let i = 0; i < text.length; i++) {
      const code = text.charCodeAt(i);
      buf[i * 2] = code & 0xff;
      buf[i * 2 + 1] = (code >> 8) & 0xff;
    }
    return buf;
  }

  build(type: number, data: Buffer): Buffer {
    const len = data.length;
    const lenBuf = Buffer.from([len & 0xff, (len >> 8) & 0xff]);

    const header = Buffer.from([this.STX, type, lenBuf[0], lenBuf[1]]);
    const body = Buffer.concat([header, data]);

    let sum = 0;
    for (const b of body) sum = (sum + b) & 0xff;

    return Buffer.concat([body, Buffer.from([sum]), Buffer.from([this.ETX])]);
  }

  buildInsertAdPacket(dataString: string, opt?: { rst?: boolean; evt?: boolean }) {
    const type = 0x84;
    let prefix = '';
    if (opt?.rst) prefix += 'RST=1,';
    if (opt?.evt) prefix += 'EVT=1,';

    const data = this.encodeText(prefix + dataString);
    return this.build(type, data);
  }

  buildDeletePacket(idx: number) {
    const type = 0x85;
    const data = this.encodeText(`IDX=${idx}`);
    return this.build(type, data);
  }

  buildPowerPacket(on: boolean) {
    const type = 0x86;
    const data = this.encodeText(`POW=${on ? 1 : 0}`);
    return this.build(type, data);
  }

  buildBrightnessPacket(level: number) {
    const type = 0x89;
    const data = this.encodeText(`BRT=${level}`);
    return this.build(type, data);
  }
}
