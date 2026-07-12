import { Injectable } from '@nestjs/common';
import { PacketBuilderService } from './packet-builder.service';
import { TransportService } from './transport.service';
import { CreateAdDto } from '../dto/create-ad.dto';

/**
 * Temporary local type.
 *
 * Keep this here until your real Prisma/model type for display boards is finalized.
 * This fixes:
 *   Cannot find name 'DisplayBoard'
 */
type DisplayBoardLike = {
  id?: string;
  name?: string | null;

  protocolMode?: 'ethernet' | 'serial' | 'rs485' | string | null;

  tcpHost?: string | null;
  tcpPort?: number | null;

  serialPort?: string | null;

  modbusHost?: string | null;
  modbusPort?: number | null;
  modbusUnitId?: number | null;
};

@Injectable()
export class LedProtocolService {
  constructor(
    private readonly builder: PacketBuilderService,

    /**
     * Existing implementation kept.
     *
     * Original code already injects TransportService as `transport`,
     * so ping() must use this.transport, not this.transportService.
     */
    private readonly transport: TransportService,
  ) {}

  async insertAd(dto: CreateAdDto) {
    const packet = this.builder.buildInsertAdPacket(dto.dataString, {
      rst: dto.rst,
      evt: dto.evt,
    });

    return this.transport.send(packet);
  }

  async deleteAd(idx: number) {
    const packet = this.builder.buildDeletePacket(idx);
    return this.transport.send(packet);
  }

  async setPower(on: boolean) {
    const packet = this.builder.buildPowerPacket(on);
    return this.transport.send(packet);
  }

  async setBrightness(level: number) {
    const packet = this.builder.buildBrightnessPacket(level);
    return this.transport.send(packet);
  }

  async ping(board: DisplayBoardLike): Promise<boolean> {
    try {
      /**
       * Temporary safe ping implementation.
       *
       * Existing future implementation:
       *
       * if (board.protocolMode === 'ethernet') {
       *   return await this.transport.tcpPing(board.tcpHost, board.tcpPort);
       * }
       *
       * if (board.protocolMode === 'serial') {
       *   return await this.transport.serialPing(board.serialPort);
       * }
       *
       * if (board.protocolMode === 'rs485') {
       *   return await this.transport.modbusPing(
       *     board.modbusHost,
       *     board.modbusPort,
       *     board.modbusUnitId,
       *   );
       * }
       *
       * Reason disabled:
       * TransportService currently only has send(), and does not yet expose
       * tcpPing(), serialPing(), or modbusPing().
       */

      if (!board) return false;

      return false;
    } catch {
      return false;
    }
  }
}