import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@parking/db';
import { PrismaService } from '../../prisma/prisma.service';
import { UpdateDisplayBoardDto } from './dto/update-display-board.dto';
import { UpdateDisplayLinesDto } from './dto/update-display-lines.dto';
import { CreateDisplayCommandDto } from './dto/create-display-command.dto';
import { ReportDisplayJobDto } from './dto/report-display-job.dto';

const BOARD_INCLUDE = {
  parkingLot: true,
  lines: {
    orderBy: [
      { source: 'asc' as const },
      { lineNo: 'asc' as const },
    ],
  },
  modules: {
    include: {
      parkingSection: true,
    },
    orderBy: [
      { rowNo: 'asc' as const },
      { colNo: 'asc' as const },
    ],
  },
  commands: {
    orderBy: { requestedAt: 'desc' as const },
    take: 5,
  },
};

type SectionStat = {
  sectionId: string;
  sectionName: string | null;
  sectionCode: string | null;
  totalSpaces: number;
  occupiedSpaces: number;
  availableSpaces: number;
};

@Injectable()
export class DisplayService {
  private parkingSpaceSectionColumn: 'parkingSectionId' | 'sectionId' | null | undefined;

  constructor(private readonly prisma: PrismaService) {}

  async listBoards(parkingLotId?: string) {
    return this.prisma.displayBoard.findMany({
      where: {
        ...(parkingLotId ? { parkingLotId } : {}),
      },
      include: BOARD_INCLUDE,
      orderBy: [
        { enabled: 'desc' },
        { name: 'asc' },
      ],
    });
  }

  async getBoard(id: string) {
    const board = await this.prisma.displayBoard.findUnique({
      where: { id },
      include: BOARD_INCLUDE,
    });

    if (!board) {
      throw new NotFoundException('Display board not found');
    }

    return board;
  }



  async createDeviceCommand(id: string, type: string, payload: any, userId?: string) {
    const board = await this.prisma.displayBoard.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!board) {
      throw new NotFoundException('Display board not found');
    }

    return this.prisma.displayCommand.create({
      data: {
        displayBoardId: id,
        type,
        payload: payload as any,
        requestedByUserId: userId,
      },
    });
  }

  async sendBrightnessCommand(id: string, brightness: number, userId?: string) {
    await this.prisma.displayBoard.update({
      where: { id },
      data: {
        brightness,
        updatedAt: new Date(),
      },
    });

    return this.createDeviceCommand(
      id,
      'BRIGHTNESS',
      { brightness },
      userId,
    );
  }

  async sendPowerCommand(id: string, powerOn: boolean, userId?: string) {
    await this.prisma.displayBoard.update({
      where: { id },
      data: {
        powerOn,
        updatedAt: new Date(),
      },
    });

    return this.createDeviceCommand(
      id,
      'POWER',
      { powerOn },
      userId,
    );
  }

  async sendSaveCommand(id: string, userId?: string) {
    return this.createDeviceCommand(
      id,
      'SAVE',
      {},
      userId,
    );
  }

  async sendTestCommand(id: string, userId?: string) {
    const preview = await this.previewBoard(id);

    return this.createDeviceCommand(
      id,
      'TEST',
      {
        message: 'DISPLAY TEST',
        preview,
      },
      userId,
    );
  }

  async updateModules(id: string, dto: any) {
    const board = await this.prisma.displayBoard.findUnique({
      where: { id },
      select: { id: true, parkingLotId: true, rows: true, cols: true },
    });

    if (!board) {
      throw new NotFoundException('Display board not found');
    }

    const modules = Array.isArray(dto.modules) ? dto.modules : [];

    for (const item of modules) {
      const rowNo = Number(item.rowNo);
      const colNo = Number(item.colNo);

      if (!Number.isFinite(rowNo) || !Number.isFinite(colNo)) {
        continue;
      }

      let parkingSectionId = item.parkingSectionId ?? null;

      if (parkingSectionId) {
        const section = await this.prisma.parkingSection.findFirst({
          where: {
            id: parkingSectionId,
            parkingLotId: board.parkingLotId,
          },
          select: { id: true },
        });

        if (!section) {
          throw new BadRequestException(`Invalid parkingSectionId: ${parkingSectionId}`);
        }
      }

      await this.prisma.displayBoardModule.upsert({
        where: {
          displayBoardId_rowNo_colNo: {
            displayBoardId: id,
            rowNo,
            colNo,
          },
        },
        create: {
          displayBoardId: id,
          rowNo,
          colNo,
          parkingSectionId,
          label: item.label ?? `${colNo}열`,
          enabled: item.enabled ?? true,
          charWidth: Number(item.charWidth ?? 4),
          padChar: String(item.padChar ?? ' ').slice(0, 1),
        },
        update: {
          parkingSectionId,
          label: item.label ?? `${colNo}열`,
          enabled: item.enabled ?? true,
          charWidth: Number(item.charWidth ?? 4),
          padChar: String(item.padChar ?? ' ').slice(0, 1),
        },
      });
    }

    return this.getBoard(id);
  }

  async updateBoard(id: string, dto: UpdateDisplayBoardDto) {
    await this.ensureBoard(id);

    const input = dto as any;

    const data: Prisma.DisplayBoardUpdateInput = {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.code !== undefined ? { code: input.code } : {}),
      ...(input.deviceId !== undefined ? { deviceId: input.deviceId } : {}),
      ...(input.macAddress !== undefined ? { macAddress: input.macAddress } : {}),
      ...(input.enabled !== undefined ? { enabled: input.enabled } : {}),

      ...(input.transport !== undefined ? { transport: input.transport } : {}),
      ...(input.tcpHost !== undefined ? { tcpHost: input.tcpHost } : {}),
      ...(input.tcpPort !== undefined ? { tcpPort: input.tcpPort } : {}),

      ...(input.serialPort !== undefined ? { serialPort: input.serialPort } : {}),
      ...(input.baudRate !== undefined ? { baudRate: input.baudRate } : {}),
      ...(input.dataBits !== undefined ? { dataBits: input.dataBits } : {}),
      ...(input.parity !== undefined ? { parity: input.parity } : {}),
      ...(input.stopBits !== undefined ? { stopBits: input.stopBits } : {}),

      ...(input.connectTimeoutMs !== undefined ? { connectTimeoutMs: input.connectTimeoutMs } : {}),
      ...(input.readTimeoutMs !== undefined ? { readTimeoutMs: input.readTimeoutMs } : {}),

      ...(input.rows !== undefined ? { rows: input.rows } : {}),
      ...(input.cols !== undefined ? { cols: input.cols } : {}),
      ...(input.moduleType !== undefined ? { moduleType: input.moduleType } : {}),
      ...(input.rgbOrder !== undefined ? { rgbOrder: input.rgbOrder } : {}),

      ...(input.brightness !== undefined ? { brightness: input.brightness } : {}),
      ...(input.powerOn !== undefined ? { powerOn: input.powerOn } : {}),

      ...(input.heartbeatIntervalSec !== undefined
        ? { heartbeatIntervalSec: input.heartbeatIntervalSec }
        : {}),
      ...(input.retryMaxAttempts !== undefined ? { retryMaxAttempts: input.retryMaxAttempts } : {}),
      ...(input.retryBackoffMs !== undefined ? { retryBackoffMs: input.retryBackoffMs } : {}),
    };

    return this.prisma.displayBoard.update({
      where: { id },
      data,
      include: BOARD_INCLUDE,
    });
  }

  async updateLines(id: string, source: 'AUTO' | 'MANUAL', dto: UpdateDisplayLinesDto) {
    await this.ensureBoard(id);

    const lines = dto.lines ?? [];

    await this.prisma.$transaction(
      lines.map((line) => {
        const input = line as any;

        return this.prisma.displayBoardLine.upsert({
          where: {
            displayBoardId_source_lineNo: {
              displayBoardId: id,
              source,
              lineNo: input.lineNo,
            },
          },
          create: {
            displayBoardId: id,
            source,
            lineNo: input.lineNo,
            textTemplate: input.textTemplate,
            enabled: input.enabled ?? true,
            fontSize: input.fontSize ?? 1,
            effect: input.effect ?? '090009000900',
            speed: input.speed ?? 2,
            delay: input.delay ?? 5,
            neon: input.neon ?? 0,
            fix: input.fix ?? false,
            colorCode: input.colorCode ?? 0,
            fontCode: input.fontCode ?? 0,
            widthCode: input.widthCode ?? 1,
            attributeCode: input.attributeCode ?? 0,
            iconCode: input.iconCode ?? null,
          },
          update: {
            textTemplate: input.textTemplate,
            enabled: input.enabled ?? true,
            fontSize: input.fontSize ?? 1,
            effect: input.effect ?? '090009000900',
            speed: input.speed ?? 2,
            delay: input.delay ?? 5,
            neon: input.neon ?? 0,
            fix: input.fix ?? false,
            colorCode: input.colorCode ?? 0,
            fontCode: input.fontCode ?? 0,
            widthCode: input.widthCode ?? 1,
            attributeCode: input.attributeCode ?? 0,
            iconCode: input.iconCode ?? null,
          },
        });
      }),
    );

    return this.getBoard(id);
  }

  async previewBoard(id: string) {
    const board = await this.getBoard(id);
    const stats = await this.getLotStats(board.parkingLotId);

    const hasModules = await this.hasModules(board.id);

    if (hasModules) {
      const lines =
        board.mode === 'MANUAL'
          ? await this.renderManualModuleRows(board)
          : await this.renderAutoModuleRows(board);

      return {
        boardId: board.id,
        parkingLotId: board.parkingLotId,
        mode: board.mode,
        manualReason: board.manualReason,
        source: board.mode === 'MANUAL' ? 'MANUAL_MODULE' : 'AUTO_MODULE',
        stats,
        lines,
        renderedAt: new Date().toISOString(),
      };
    }

    const source = board.mode === 'MANUAL' ? 'MANUAL' : 'AUTO';

    const lines = board.lines
      .filter((line) => line.source === source && line.enabled)
      .sort((a, b) => a.lineNo - b.lineNo)
      .map((line) => ({
        lineNo: line.lineNo,
        text: this.renderTemplate(line.textTemplate, stats),
        rawTemplate: line.textTemplate,
        fontSize: line.fontSize,
        effect: line.effect,
        speed: line.speed,
        delay: line.delay,
        colorCode: line.colorCode ?? 0,
      }));

    return {
      boardId: board.id,
      parkingLotId: board.parkingLotId,
      mode: board.mode,
      manualReason: board.manualReason,
      source,
      stats,
      lines,
      renderedAt: new Date().toISOString(),
    };
  }

  async createCommand(id: string, dto: CreateDisplayCommandDto, userId?: string) {
    await this.ensureBoard(id);

    return this.prisma.displayCommand.create({
      data: {
        displayBoardId: id,
        type: dto.type,
        payload: (dto.payload ?? {}) as Prisma.InputJsonValue,
        requestedByUserId: userId,
      },
    });
  }

  async publish(id: string, userId?: string) {
    const preview = await this.previewBoard(id);

    return this.prisma.displayCommand.create({
      data: {
        displayBoardId: id,
        type: 'PUBLISH',
        payload: preview as unknown as Prisma.InputJsonValue,
        requestedByUserId: userId,
      },
    });
  }

  async setManualMode(
    id: string,
    dto: UpdateDisplayLinesDto,
    reason?: string,
    userId?: string,
  ) {
    const requestedLines = ((dto as any).lines ?? []) as any[];

    await this.updateLines(id, 'MANUAL', dto);

    await this.prisma.displayBoard.update({
      where: { id },
      data: {
        mode: 'MANUAL',
        manualReason: reason ?? null,
      },
    });

    const preview = await this.previewBoard(id);
    const requestedByLineNo = new Map<number, any>(
      requestedLines.map((line) => [Number(line.lineNo), line]),
    );

    const payload = {
      ...(preview as any),
      lines: (preview as any).lines.map((line: any) => {
        const requestedLine = requestedByLineNo.get(Number(line.lineNo));
        const requestedModules = requestedLine?.modules ?? [];
        const requestedByColNo = new Map<number, any>(
          requestedModules.map((module: any) => [Number(module.colNo), module]),
        );

        const modules = (line.modules ?? []).map((module: any) => {
          const requestedModule = requestedByColNo.get(Number(module.colNo));

          return {
            ...module,
            value: requestedModule?.value ?? module.value,
            colorCode:
              requestedModule?.colorCode !== undefined
                ? Number(requestedModule.colorCode)
                : module.colorCode ?? requestedLine?.colorCode ?? 0,
            fontCode:
              requestedModule?.fontCode !== undefined
                ? Number(requestedModule.fontCode)
                : module.fontCode ?? requestedLine?.fontCode ?? 0,
          };
        });

        return {
          ...line,
          colorCode: modules[0]?.colorCode ?? requestedLine?.colorCode ?? line.colorCode ?? 0,
          fontCode: modules[0]?.fontCode ?? requestedLine?.fontCode ?? line.fontCode ?? 0,
          modules,
        };
      }),
    };

    return this.prisma.displayCommand.create({
      data: {
        displayBoardId: id,
        type: 'PUBLISH',
        payload: payload as unknown as Prisma.InputJsonValue,
        requestedByUserId: userId,
      },
    });
  }

  async setAutoMode(id: string, userId?: string) {
    await this.ensureBoard(id);

    await this.prisma.displayBoard.update({
      where: { id },
      data: {
        mode: 'AUTO',
        manualReason: null,
        manualExpiresAt: null,
      },
    });

    return this.publish(id, userId);
  }

  async getDaemonJobs(_daemonId?: string) {
    return this.prisma.displayCommand.findMany({
      where: {
        status: 'PENDING',
        displayBoard: {
          enabled: true,
        },
      },
      include: {
        displayBoard: {
          include: {
            parkingLot: true,
            modules: {
              include: {
                parkingSection: true,
              },
              orderBy: [
                { rowNo: 'asc' },
                { colNo: 'asc' },
              ],
            },
          },
        },
      },
      orderBy: {
        requestedAt: 'asc',
      },
      take: 10,
    });
  }

  async reportJobResult(id: string, dto: ReportDisplayJobDto) {
    const command = await this.prisma.displayCommand.findUnique({
      where: { id },
      include: {
        displayBoard: true,
      },
    });

    if (!command) {
      throw new NotFoundException('Display command not found');
    }

    const now = new Date();
    const status = dto.status;

    const updated = await this.prisma.displayCommand.update({
      where: { id },
      data: {
        status,
        packetHex: dto.packetHex ?? undefined,
        responseHex: dto.responseHex ?? undefined,
        errorMessage: dto.errorMessage ?? '',
        attempts: {
          increment: 1,
        },
        processingAt: command.processingAt ?? now,
        sentAt: ['SENT', 'ACKED'].includes(status) ? now : command.sentAt,
        ackedAt: status === 'ACKED' ? now : command.ackedAt,
        failedAt: status === 'FAILED' ? now : command.failedAt,
      },
    });

    if (status === 'ACKED') {
      await this.prisma.displayBoard.update({
        where: { id: command.displayBoardId },
        data: {
          lastStatus: 'OK',
          lastError: null,
          lastSentAt: now,
          lastAckAt: now,
          lastSentPayload: command.payload as Prisma.InputJsonValue,
          lastResponseHex: dto.responseHex ?? null,
        },
      });
    }

    if (status === 'FAILED') {
      await this.prisma.displayBoard.update({
        where: { id: command.displayBoardId },
        data: {
          lastStatus: 'ERROR',
          lastError: dto.errorMessage ?? 'Display command failed',
          lastSentAt: now,
          lastResponseHex: dto.responseHex ?? null,
        },
      });
    }

    return updated;
  }

  private async ensureBoard(id: string) {
    const board = await this.prisma.displayBoard.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!board) {
      throw new NotFoundException('Display board not found');
    }

    return board;
  }

  private async hasModules(displayBoardId: string) {
    const board = await this.prisma.displayBoard.findUnique({
      where: { id: displayBoardId },
      select: {
        id: true,
        rows: true,
        cols: true,
      },
    });

    if (!board) {
      return false;
    }

    if ((board.rows ?? 0) > 0 && (board.cols ?? 0) > 0) {
      return true;
    }

    const count = await this.prisma.displayBoardModule.count({
      where: {
        displayBoardId,
        enabled: true,
      },
    });

    return count > 0;
  }

  private async getLotStats(parkingLotId: string) {
    const lot = await this.prisma.parkingLot.findUnique({
      where: { id: parkingLotId },
      select: {
        name: true,
      },
    });

    const sections = await this.getSectionStats(parkingLotId);

    const totalSpaces = sections.reduce((sum, section) => sum + section.totalSpaces, 0);
    const occupiedSpaces = sections.reduce((sum, section) => sum + section.occupiedSpaces, 0);
    const availableSpaces = Math.max(0, totalSpaces - occupiedSpaces);

    return {
      lotName: lot?.name ?? '',
      totalSpaces,
      occupiedSpaces,
      availableSpaces,
    };
  }

  private async getSectionStats(parkingLotId: string): Promise<SectionStat[]> {
    const column = await this.getParkingSpaceSectionColumn();

    if (column === 'parkingSectionId') {
      const rows = await this.prisma.$queryRaw<
        Array<{
          sectionId: string;
          sectionName: string | null;
          sectionCode: string | null;
          totalSpaces: bigint | number;
          occupiedSpaces: bigint | number;
        }>
      >(Prisma.sql`
        select
          s.id as "sectionId",
          s.name as "sectionName",
          s.code as "sectionCode",
          count(p.id) as "totalSpaces",
          coalesce(sum(case when p.status::text = 'OCCUPIED' then 1 else 0 end), 0) as "occupiedSpaces"
        from "ParkingSection" s
        left join "ParkingSpace" p on p."parkingSectionId" = s.id
        where s."parkingLotId" = ${parkingLotId}
        group by s.id, s.name, s.code
        order by s.code asc nulls last, s.name asc nulls last, s.id asc
      `);

      return rows.map((row) => this.normalizeSectionStat(row));
    }

    if (column === 'sectionId') {
      const rows = await this.prisma.$queryRaw<
        Array<{
          sectionId: string;
          sectionName: string | null;
          sectionCode: string | null;
          totalSpaces: bigint | number;
          occupiedSpaces: bigint | number;
        }>
      >(Prisma.sql`
        select
          s.id as "sectionId",
          s.name as "sectionName",
          s.code as "sectionCode",
          count(p.id) as "totalSpaces",
          coalesce(sum(case when p.status::text = 'OCCUPIED' then 1 else 0 end), 0) as "occupiedSpaces"
        from "ParkingSection" s
        left join "ParkingSpace" p on p."sectionId" = s.id
        where s."parkingLotId" = ${parkingLotId}
        group by s.id, s.name, s.code
        order by s.code asc nulls last, s.name asc nulls last, s.id asc
      `);

      return rows.map((row) => this.normalizeSectionStat(row));
    }

    const sections = await this.prisma.parkingSection.findMany({
      where: { parkingLotId },
      select: {
        id: true,
        name: true,
        code: true,
      },
      orderBy: [
        { code: 'asc' },
        { name: 'asc' },
        { id: 'asc' },
      ],
    });

    return sections.map((section) => ({
      sectionId: section.id,
      sectionName: section.name,
      sectionCode: section.code,
      totalSpaces: 0,
      occupiedSpaces: 0,
      availableSpaces: 0,
    }));
  }

  private normalizeSectionStat(row: {
    sectionId: string;
    sectionName: string | null;
    sectionCode: string | null;
    totalSpaces: bigint | number;
    occupiedSpaces: bigint | number;
  }): SectionStat {
    const totalSpaces = Number(row.totalSpaces ?? 0);
    const occupiedSpaces = Number(row.occupiedSpaces ?? 0);

    return {
      sectionId: row.sectionId,
      sectionName: row.sectionName,
      sectionCode: row.sectionCode,
      totalSpaces,
      occupiedSpaces,
      availableSpaces: Math.max(0, totalSpaces - occupiedSpaces),
    };
  }

  private async getParkingSpaceSectionColumn() {
    if (this.parkingSpaceSectionColumn !== undefined) {
      return this.parkingSpaceSectionColumn;
    }

    const rows = await this.prisma.$queryRaw<Array<{ column_name: string }>>(Prisma.sql`
      select column_name
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'ParkingSpace'
        and column_name in ('parkingSectionId', 'sectionId')
      order by case column_name
        when 'parkingSectionId' then 1
        when 'sectionId' then 2
        else 3
      end
    `);

    const found = rows[0]?.column_name;

    if (found === 'parkingSectionId' || found === 'sectionId') {
      this.parkingSpaceSectionColumn = found;
    } else {
      this.parkingSpaceSectionColumn = null;
    }

    return this.parkingSpaceSectionColumn;
  }

  private async getModules(board: any) {
    const modules = await this.prisma.displayBoardModule.findMany({
      where: {
        displayBoardId: board.id,
        enabled: true,
      },
      include: {
        parkingSection: true,
      },
      orderBy: [
        { rowNo: 'asc' },
        { colNo: 'asc' },
      ],
    });

    return this.ensureMinimumModuleGrid(board, modules);
  }

  private ensureMinimumModuleGrid(board: any, modules: any[]) {
    const minRows = Math.max(1, Number(board.rows ?? 1));
    const minCols = Math.max(4, Number(board.cols ?? 4));

    const byPosition = new Map<string, any>();

    for (const module of modules) {
      byPosition.set(`${module.rowNo}:${module.colNo}`, module);
    }

    const result: any[] = [];

    for (let rowNo = 1; rowNo <= minRows; rowNo += 1) {
      for (let colNo = 1; colNo <= minCols; colNo += 1) {
        const existing = byPosition.get(`${rowNo}:${colNo}`);

        if (existing) {
          result.push(existing);
          continue;
        }

        result.push({
          id: `virtual-${board.id}-${rowNo}-${colNo}`,
          displayBoardId: board.id,
          rowNo,
          colNo,
          parkingSectionId: null,
          parkingSection: null,
          label: `${colNo}열`,
          enabled: true,
          charWidth: 4,
          padChar: ' ',
          createdAt: null,
          updatedAt: null,
          __virtual: true,
        });
      }
    }

    return result.sort((a, b) => {
      if (a.rowNo !== b.rowNo) return a.rowNo - b.rowNo;
      return a.colNo - b.colNo;
    });
  }

  private async renderAutoModuleRows(board: any) {
    const modules = await this.getModules(board);
    const sectionStats = await this.getSectionStats(board.parkingLotId);
    const statsBySectionId = new Map(sectionStats.map((item) => [item.sectionId, item]));
    const rows = this.groupModulesByRow(modules);

    return rows.map(([rowNo, rowModules]) => {
      const ordered = rowModules.sort((a: any, b: any) => a.colNo - b.colNo);

      const text = ordered
        .map((module: any) => {
          const stat = module.parkingSectionId
            ? statsBySectionId.get(module.parkingSectionId)
            : null;

          return this.formatModuleNumber(
            stat?.availableSpaces ?? 0,
            module.charWidth ?? 4,
            module.padChar ?? ' ',
          );
        })
        .join('');

      return {
        lineNo: rowNo,
        text,
        rawTemplate: ordered.map((module: any) => module.label ?? `${module.colNo}열`).join(' '),
        fontSize: 1,
        effect: '090009000900',
        speed: 2,
        delay: 5,
        colorCode: 0,
        modules: ordered.map((module: any) => {
          const stat = module.parkingSectionId
            ? statsBySectionId.get(module.parkingSectionId)
            : null;

          return {
            rowNo: module.rowNo,
            colNo: module.colNo,
            label: module.label,
            parkingSectionId: module.parkingSectionId,
            sectionName: module.parkingSection?.name ?? null,
            sectionCode: module.parkingSection?.code ?? null,
            value: this.formatModuleNumber(
              stat?.availableSpaces ?? 0,
              module.charWidth ?? 4,
              module.padChar ?? ' ',
            ),
            availableSpaces: stat?.availableSpaces ?? 0,
            totalSpaces: stat?.totalSpaces ?? 0,
            occupiedSpaces: stat?.occupiedSpaces ?? 0,
            charWidth: module.charWidth ?? 4,
          };
        }),
      };
    });
  }

  private async renderManualModuleRows(board: any) {
    const modules = await this.getModules(board);
    const rows = this.groupModulesByRow(modules);

    const manualLines = await this.prisma.displayBoardLine.findMany({
      where: {
        displayBoardId: board.id,
        source: 'MANUAL',
        enabled: true,
      },
      orderBy: {
        lineNo: 'asc',
      },
    });

    const manualByLineNo = new Map(manualLines.map((line) => [line.lineNo, line]));

    return rows.map(([rowNo, rowModules]) => {
      const ordered = rowModules.sort((a: any, b: any) => a.colNo - b.colNo);
      const manualText = manualByLineNo.get(rowNo)?.textTemplate ?? '';
      const values = this.splitManualTextByModules(manualText, ordered);

      const text = values.join('');

      return {
        lineNo: rowNo,
        text,
        rawTemplate: manualText,
        fontSize: manualByLineNo.get(rowNo)?.fontSize ?? 1,
        effect: manualByLineNo.get(rowNo)?.effect ?? '090009000900',
        speed: manualByLineNo.get(rowNo)?.speed ?? 2,
        delay: manualByLineNo.get(rowNo)?.delay ?? 5,
        colorCode: manualByLineNo.get(rowNo)?.colorCode ?? 0,
        modules: ordered.map((module: any, index: number) => ({
          rowNo: module.rowNo,
          colNo: module.colNo,
          label: module.label,
          parkingSectionId: module.parkingSectionId,
          sectionName: module.parkingSection?.name ?? null,
          sectionCode: module.parkingSection?.code ?? null,
          value: values[index] ?? this.emptyModuleValue(module.charWidth ?? 4, module.padChar ?? ' '),
          charWidth: module.charWidth ?? 4,
        })),
      };
    });
  }

  private groupModulesByRow(modules: any[]) {
    const rowMap = new Map<number, any[]>();

    for (const module of modules) {
      const list = rowMap.get(module.rowNo) ?? [];
      list.push(module);
      rowMap.set(module.rowNo, list);
    }

    return Array.from(rowMap.entries()).sort(([a], [b]) => a - b);
  }

  private splitManualTextByModules(text: string, modules: any[]) {
    let cursor = 0;
    const source = String(text ?? '');

    return modules.map((module) => {
      const width = module.charWidth ?? 4;
      const padChar = module.padChar ?? ' ';
      const value = source.slice(cursor, cursor + width);
      cursor += width;

      return this.normalizeManualValue(value, width, padChar);
    });
  }

  private normalizeManualValue(value: string, width: number, padChar = ' ') {
    const safeWidth = Math.max(1, width || 4);
    const text = String(value ?? '').trim();

    if (!text) {
      return this.rightAlignDisplayText('', safeWidth, padChar || ' ');
    }

    return this.rightAlignDisplayText(text, safeWidth, padChar || ' ');
  }

  private emptyModuleValue(width: number, padChar = ' ') {
    return this.rightAlignDisplayText('', Math.max(1, width || 4), padChar || ' ');
  }

  private formatModuleNumber(value: number, width: number, padChar = ' ') {
    const safeWidth = Math.max(1, width || 4);
    const max = Number('9'.repeat(safeWidth));
    const normalized = Math.max(0, Math.min(value, max));

    return this.rightAlignDisplayText(String(normalized), safeWidth, padChar || ' ');
  }

  private rightAlignDisplayText(value: string, width: number, padChar = ' ') {
    const safeWidth = Math.max(1, width || 4);
    const safePad = padChar && padChar.length > 0 ? padChar[0] : ' ';

    const clipped = this.clipDisplayTextFromRight(value ?? '', safeWidth);
    const displayWidth = this.getDisplayWidth(clipped);
    const padCount = Math.max(0, safeWidth - displayWidth);

    return `${safePad.repeat(padCount)}${clipped}`;
  }

  private clipDisplayTextFromRight(value: string, maxWidth: number) {
    const chars = Array.from(String(value ?? ''));
    const result: string[] = [];
    let width = 0;

    for (let index = chars.length - 1; index >= 0; index -= 1) {
      const char = chars[index];
      const charWidth = this.getCharDisplayWidth(char);

      if (width + charWidth > maxWidth) {
        continue;
      }

      result.unshift(char);
      width += charWidth;

      if (width >= maxWidth) {
        break;
      }
    }

    return result.join('');
  }

  private getDisplayWidth(value: string) {
    return Array.from(String(value ?? '')).reduce(
      (sum, char) => sum + this.getCharDisplayWidth(char),
      0,
    );
  }

  private getCharDisplayWidth(char: string) {
    if (!char) {
      return 0;
    }

    const code = char.codePointAt(0) ?? 0;

    if (
      (code >= 0x1100 && code <= 0x11ff) ||
      (code >= 0x3130 && code <= 0x318f) ||
      (code >= 0xac00 && code <= 0xd7af) ||
      (code >= 0x2e80 && code <= 0x9fff) ||
      (code >= 0xf900 && code <= 0xfaff)
    ) {
      return 2;
    }

    return 1;
  }

  private renderTemplate(template: string, stats: Record<string, unknown>) {
    return template.replace(/\{([a-zA-Z0-9_]+)\}/g, (_, key: string) => {
      const value = stats[key];

      if (value === undefined || value === null) {
        return '';
      }

      return String(value);
    });
  }
}
