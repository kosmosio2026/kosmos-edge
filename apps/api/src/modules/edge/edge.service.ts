import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class EdgeService {
  constructor(private readonly prisma: PrismaService) {}

  async handshake(edgeNodeId: string) {
    const edgeNode = await this.prisma.edgeNode.findUnique({
      where: {
        id: edgeNodeId,
      },
      include: {
        managementCompany: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
        parkingLots: {
          include: {
            parkingLot: true,
          },
        },
      },
    });

    if (!edgeNode) {
      throw new NotFoundException('Edge node not found');
    }

    await this.prisma.edgeNode.update({
      where: {
        id: edgeNode.id,
      },
      data: {
        lastSeenAt: new Date(),
      },
    });

    return {
      ok: true,
      edgeNode: {
        id: edgeNode.id,
        code: edgeNode.code,
        name: edgeNode.name,
        status: edgeNode.status,
        tenantId: null,
        managementCompanyId: edgeNode.managementCompanyId ?? null,
        managementCompanyName: edgeNode.managementCompany?.name ?? null,
        managementCompanyCode: edgeNode.managementCompany?.code ?? null,
        tenantName: null,
        parkingLots: edgeNode.parkingLots.map((link) => ({
          id: link.parkingLot.id,
          code: link.parkingLot.code,
          name: link.parkingLot.name,
          operationMode: link.parkingLot.operationMode,
          isActive: link.parkingLot.isActive,
        })),
      },
      serverTime: new Date().toISOString(),
    };
  }
}