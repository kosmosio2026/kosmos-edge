import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@parking/db';
import { PaginatedResponse } from '@parking/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

type SessionListQuery = PaginationQueryDto & {
  status?: string;
  parkingLotId?: string;
  parkingSectionId?: string;
  parkingSpaceId?: string;
};

@Injectable()
export class SessionsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: SessionListQuery): Promise<PaginatedResponse<any>> {
    const page = Number(query.page ?? 1);
    const pageSize = Number(query.pageSize ?? 20);
    const skip = (page - 1) * pageSize;

    const where: Prisma.ParkingSessionWhereInput = {
      ...(query.search
        ? {
            OR: [
              {
                sessionNo: {
                  contains: query.search,
                  mode: 'insensitive',
                },
              },
              {
                plateNumber: {
                  contains: query.search,
                  mode: 'insensitive',
                },
              },
              {
                vehicle: {
                  plateNumber: {
                    contains: query.search,
                    mode: 'insensitive',
                  },
                },
              },
            ],
          }
        : {}),

      ...(query.status ? { status: query.status as any } : {}),

      ...(query.parkingSpaceId
        ? { parkingSpaceId: query.parkingSpaceId }
        : {}),

      ...(query.parkingSectionId || query.parkingLotId
        ? {
            ParkingSpace: {
              ...(query.parkingSectionId
                ? { sectionId: query.parkingSectionId }
                : {}),
              ...(query.parkingLotId
                ? {
                    section: {
                      parkingLotId: query.parkingLotId,
                    },
                  }
                : {}),
            },
          }
        : {}),
    };

    let items: any[] = [];
    let total = 0;

    try {
      [items, total] = await Promise.all([
        this.prisma.parkingSession.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip,
          take: pageSize,
          include: {
            user: {
              select: {
                id: true,
                email: true,
                name: true,
                phone: true,
              },
            },
            vehicle: true,
            ParkingSpace: {
              include: {
                section: {
                  include: {
                    parkingLot: true,
                  },
                },
              },
            },
            invoice: {
              include: {
                payments: true,
              },
            },
            receipts: true,
          },
        }),
        this.prisma.parkingSession.count({ where }),
      ]);
    } catch (error) {
      console.error('[sessions.list] failed', {
        query,
        where,
        page,
        pageSize,
        error,
      });
      throw error;
    }

    return {
      items,
      meta: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    };
  }

  async getById(id: string) {
    const session = await this.prisma.parkingSession.findUnique({
      where: { id },
      include: {
        vehicle: true,
        user: true,
        ParkingSpace: {
          include: {
            section: {
              include: {
                parkingLot: true,
              },
            },
          },
        },
        invoice: {
          include: {
            payments: true,
          },
        },
        receipts: true,
        events: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!session) {
      throw new NotFoundException('Session not found');
    }

    return session;
  }
}