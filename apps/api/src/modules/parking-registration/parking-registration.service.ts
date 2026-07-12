import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';

type RegisterParkingDto = {
  sessionId?: string;
  parkingSpaceId?: string;
  plateNumber?: string;
  vehicleNo?: string;
  driverName?: string;
  phone?: string;
  registrationSource?: string;
  note?: string;
};

type RegisterActiveSessionInput = {
  userId: string;
  roles: string[];
  dto: RegisterParkingDto;
};

const ACTIVE_SESSION_STATUSES = ['ACTIVE', 'GRACE_PERIOD', 'CREATED'];

@Injectable()
export class ParkingRegistrationService {
  constructor(private readonly prisma: PrismaService) {}

  async registerActiveSession(input: RegisterActiveSessionInput) {
    const { userId, roles, dto } = input;

    if (!dto.sessionId && !dto.parkingSpaceId) {
      throw new BadRequestException(
        'sessionId or parkingSpaceId is required',
      );
    }

    const session = dto.sessionId
      ? await this.findActiveSessionById(dto.sessionId)
      : await this.findActiveSessionBySpaceId(dto.parkingSpaceId!);

    if (!session) {
      throw new NotFoundException(
        'No active parking session found for registration',
      );
    }

    if (session.isRegistered) {
      throw new ConflictException('Parking session is already registered');
    }

    const now = new Date();

    const registrationSource =
      dto.registrationSource ??
      this.inferRegistrationSource(roles);

    const plateNumber = dto.plateNumber ?? dto.vehicleNo ?? null;

    const previousMetadata = this.asRecord(session.metadata);

    const nextMetadata = {
      ...previousMetadata,
      unregisteredOverdue: false,
      registeredAt: now.toISOString(),
      paymentRequired: true,
      paymentStatus:
        previousMetadata.paymentStatus === 'PAID'
          ? 'PAID'
          : 'ACCRUING',
      exitedUnpaid: false,
      registration: {
        source: registrationSource,
        registeredByUserId: userId,
        plateNumber,
        driverName: dto.driverName ?? null,
        phone: dto.phone ?? null,
        note: dto.note ?? null,
      },
      plateNumber,
      driverName: dto.driverName ?? null,
      phone: dto.phone ?? null,
    };

    const updatedSession = await this.prisma.parkingSession.update({
      where: {
        id: session.id,
      },
      data: {
        isRegistered: true,
        metadata: nextMetadata as any,
        events: {
          create: {
            type: 'REGISTERED',
            source: registrationSource,
            payload: {
              sessionId: session.id,
              sessionNo: session.sessionNo,
              parkingSpaceId: session.parkingSpaceId,
              registeredByUserId: userId,
              registrationSource,
              plateNumber,
              driverName: dto.driverName ?? null,
              phone: dto.phone ?? null,
              registeredAt: now.toISOString(),
              previousPaymentStatus:
                previousMetadata.paymentStatus ?? null,
              nextPaymentStatus: nextMetadata.paymentStatus,
            } as any,
          },
        },
      },
    });

    await this.createDomainEvent({
      aggregateType: 'ParkingSession',
      aggregateId: updatedSession.id,
      eventType: 'PARKING_SESSION_REGISTERED',
      payload: {
        sessionId: updatedSession.id,
        sessionNo: updatedSession.sessionNo,
        parkingSpaceId: updatedSession.parkingSpaceId,
        registeredByUserId: userId,
        registrationSource,
        plateNumber,
        driverName: dto.driverName ?? null,
        phone: dto.phone ?? null,
        previousPaymentStatus:
          previousMetadata.paymentStatus ?? null,
        nextPaymentStatus: nextMetadata.paymentStatus,
      },
      occurredAt: now,
    });

    return {
      ok: true,
      action: 'SESSION_REGISTERED',
      sessionId: updatedSession.id,
      sessionNo: updatedSession.sessionNo,
      parkingSpaceId: updatedSession.parkingSpaceId,
      isRegistered: updatedSession.isRegistered,
      registrationSource,
      plateNumber,
      paymentStatus: nextMetadata.paymentStatus,
    };
  }

  private async findActiveSessionById(sessionId: string) {
    return this.prisma.parkingSession.findFirst({
      where: {
        id: sessionId,
        status: {
          in: ACTIVE_SESSION_STATUSES as any,
        },
      },
      orderBy: {
        entryTime: 'desc',
      },
    });
  }

  private async findActiveSessionBySpaceId(parkingSpaceId: string) {
    return this.prisma.parkingSession.findFirst({
      where: {
        parkingSpaceId,
        status: {
          in: ACTIVE_SESSION_STATUSES as any,
        },
      },
      orderBy: {
        entryTime: 'desc',
      },
    });
  }

  private inferRegistrationSource(roles: string[]) {
    if (roles.includes('OPERATOR') || roles.includes('PARKING_OPERATOR')) {
      return 'OPERATOR_APP';
    }

    if (roles.includes('ADMIN') || roles.includes('CLOUD_ADMIN')) {
      return 'CLOUD_ADMIN';
    }

    if (roles.includes('VISITOR')) {
      return 'VISITOR_MOBILE';
    }

    return 'MEMBER_MOBILE';
  }

  private asRecord(value: unknown): Record<string, any> {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return {};
    }

    return value as Record<string, any>;
  }

  private async createDomainEvent(input: {
    aggregateType: string;
    aggregateId: string;
    eventType: string;
    payload: Record<string, unknown>;
    occurredAt: Date;
  }) {
    return this.prisma.domainEvent.create({
      data: {
        eventId: randomUUID(),
        aggregateType: input.aggregateType,
        aggregateId: input.aggregateId,
        eventType: input.eventType,
        payload: input.payload as any,
        occurredAt: input.occurredAt,
      },
    });
  }
}