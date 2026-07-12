import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class WatcherService {
  constructor(private readonly prisma: PrismaService) {}

  async apply(userId: string, parkingLotId: string) {
    if (!parkingLotId) {
      throw new BadRequestException('parkingLotId is required');
    }

    const lot = await this.prisma.parkingLot.findUnique({ where: { id: parkingLotId } });
    if (!lot) throw new NotFoundException('Parking lot not found');

    const existing = await this.prisma.watcherApplication.findFirst({
      where: {
        watcherUserId: userId,
        parkingLotId,
        status: { in: ['PENDING', 'APPROVED'] as any },
      },
      orderBy: { requestedAt: 'desc' },
    });

    if (existing) {
      throw new BadRequestException(
        existing.status === 'PENDING'
          ? 'Already applied for this parking lot'
          : 'Already approved for this parking lot',
      );
    }

    return this.prisma.watcherApplication.create({
      data: {
        watcherUserId: userId,
        parkingLotId,
      },
      include: {
        parkingLot: true,
        watcher: true,
      },
    });
  }


  async getApplications(userId: string) {
    return this.prisma.watcherApplication.findMany({
      where: {
        watcherUserId: userId,
      },
      include: {
        parkingLot: true,
        approvedBy: true,
        rejectedBy: true,
      },
      orderBy: {
        requestedAt: 'desc',
      },
    });
  }

  async getLots(userId: string) {
    return this.prisma.watcherLotBinding.findMany({
      where: {
        watcherUserId: userId,
        status: 'ACTIVE',
      },
      include: {
        parkingLot: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getEnforcementCases(userId: string) {
    const bindings = await this.prisma.watcherLotBinding.findMany({
      where: { watcherUserId: userId, status: 'ACTIVE' },
      select: { parkingLotId: true },
    });

    const lotIds = bindings.map((b) => b.parkingLotId);

    if (lotIds.length === 0) return [];

    return this.prisma.enforcementCase.findMany({
      where: {
        parkingLotId: { in: lotIds },
        status: { in: ['OPEN', 'IN_PROGRESS'] as any },
      },
      include: {
        parkingLot: true,
        parkingSession: {
          include: {
            ParkingSpace: {
              include: { section: true },
            },
          },
        },
      },
      orderBy: { detectedAt: 'desc' },
    });
  }

  async registerProxy(
    userId: string,
    caseId: string,
    dto: {
      vehiclePlateNumber: string;
      contactPhone?: string;
      note?: string;
      vehiclePlatePhotoUrl?: string;
      ocrResult?: any;
    },
  ) {
    if (!dto.vehiclePlateNumber) throw new BadRequestException('vehiclePlateNumber is required');
    if (!dto.vehiclePlatePhotoUrl) throw new BadRequestException('vehiclePlatePhotoUrl is required');

    const vehiclePlatePhotoUrl = dto.vehiclePlatePhotoUrl;

    const enforcementCase = await this.prisma.enforcementCase.findUnique({
      where: { id: caseId },
      include: { parkingSession: true },
    });

    if (!enforcementCase) throw new NotFoundException('Enforcement case not found');

    const binding = await this.prisma.watcherLotBinding.findUnique({
      where: {
        watcherUserId_parkingLotId: {
          watcherUserId: userId,
          parkingLotId: enforcementCase.parkingLotId,
        },
      },
    });

    if (!binding || binding.status !== 'ACTIVE') {
      throw new BadRequestException('No watcher permission for this parking lot');
    }

    return this.prisma.$transaction(async (tx) => {
      const session = await tx.parkingSession.findUnique({
        where: { id: enforcementCase.parkingSessionId },
      });

      if (!session || session.isRegistered) {
        throw new BadRequestException('Parking session already registered or not found');
      }

      const updatedSession = await tx.parkingSession.update({
        where: { id: session.id },
        data: {
          plateNumber: dto.vehiclePlateNumber,
          contactPhone: dto.contactPhone,
          isRegistered: true,
          registeredAt: new Date(),
          registeredByUserId: userId,
          registrationStatus: 'REGISTERED_BY_WATCHER' as any,
          registrationMethod: 'WATCHER_PROXY' as any,
        },
      });

      await tx.parkingRegistrationPhoto.create({
        data: {
          parkingSessionId: session.id,
          imageUrl: vehiclePlatePhotoUrl,
          required: true,
          capturedByUserId: userId,
          capturedByRole: 'WATCHER',
        },
      });

      const proxyLog = await tx.registrationProxyLog.create({
        data: {
          parkingSessionId: session.id,
          performedByUserId: userId,
          performedByRole: 'WATCHER',
          vehiclePlateNumber: dto.vehiclePlateNumber,
          contactPhone: dto.contactPhone,
          note: dto.note,
          photoRequired: true,
        },
      });

      if (dto.ocrResult) {
        await tx.plateRecognitionResult.create({
          data: {
            parkingSessionId: session.id,
            enforcementCaseId: enforcementCase.id,
            registrationProxyLogId: proxyLog.id,
            imageUrl: vehiclePlatePhotoUrl,
            provider: dto.ocrResult.provider ?? 'UNKNOWN',
            mode: dto.ocrResult.mode ?? 'UNKNOWN',
            country: dto.ocrResult.country ?? 'KR',
            suggestedPlateNumber: dto.ocrResult.plateNumber ?? dto.vehiclePlateNumber,
            reviewedPlateNumber: dto.vehiclePlateNumber,
            confidence:
              typeof dto.ocrResult.confidence === 'number'
                ? dto.ocrResult.confidence
                : null,
            candidates: dto.ocrResult.candidates ?? [],
            rawResponse: dto.ocrResult,
            createdByUserId: userId,
          },
        });
      }

      await tx.enforcementCase.update({
        where: { id: caseId },
        data: {
          status: 'REGISTERED' as any,
          resolvedByUserId: userId,
          resolvedAt: new Date(),
          note: dto.note,
        },
      });

      return updatedSession;
    });
  }

  async getRegistrationProxyLogs(userId: string) {
    return this.prisma.registrationProxyLog.findMany({
      where: { performedByUserId: userId },
      include: {
        parkingSession: {
          include: {
            ParkingSpace: {
              include: {
                section: {
                  include: {
                    parkingLot: true,
                  },
                },
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }
}
