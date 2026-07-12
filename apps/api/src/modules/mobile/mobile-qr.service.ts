import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@parking/db';
import { hash } from 'bcrypt';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class MobileQrService {
  constructor(private readonly prisma: PrismaService) {}

  private getJwtUserId(jwtUser: any) {
    const userId = jwtUser?.sub ?? jwtUser?.userId ?? jwtUser?.id;
    if (!userId) {
      throw new BadRequestException('Invalid mobile token');
    }
    return String(userId);
  }

  async getQrParkingLot(qrToken: string) {
    const qr = await this.prisma.parkingLotQr.findUnique({
      where: { qrToken },
      include: {
        parkingLot: {
          include: {
            photos: { orderBy: [{ isPrimary: 'desc' }, { sortOrder: 'asc' }] },
            sections: {
              where: { isActive: true },
              orderBy: [{ name: 'asc' }],
              include: {
                spaces: {
                  where: { isActive: true },
                  orderBy: [{ code: 'asc' }],
                  include: {
                    sessions: {
                      where: {
                        status: { in: ['ACTIVE', 'GRACE_PERIOD', 'CREATED'] as any },
                        isRegistered: false,
                      },
                      orderBy: { entryTime: 'desc' },
                      take: 1,
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!qr || !qr.isActive) {
      throw new NotFoundException('Invalid or inactive QR code');
    }

    if (qr.expiresAt && qr.expiresAt.getTime() < Date.now()) {
      throw new BadRequestException('Expired QR code');
    }

    const lot = qr.parkingLot;

    return {
      qrToken: qr.qrToken,
      parkingLot: {
        id: lot.id,
        name: lot.name,
        code: lot.code,
        address: lot.address,
        region: lot.region,
        sido: lot.region,
        sigungu: lot.district,
        district: lot.district,
        lat: lot.lat,
        lng: lot.lng,
        graceMinutes: lot.graceMinutes,
        photos: lot.photos,
      },
      sections: lot.sections.map((section) => ({
        id: section.id,
        name: section.name,
        code: section.code,
        spaces: section.spaces
          .map((space) => {
            const activeUnregisteredSession = space.sessions[0] ?? null;
            const occupiedUnregistered = Boolean(activeUnregisteredSession);

            return {
              id: space.id,
              code: space.code,
              number: space.number,
              type: space.type,
              lat: space.lat,
              lng: space.lng,
              widthMeter: space.widthMeter,
              heightMeter: space.heightMeter,
              rotationDeg: space.rotationDeg,
              status: occupiedUnregistered
                ? 'OCCUPIED_UNREGISTERED'
                : space.status,
              priority: occupiedUnregistered,
              activeSessionId: activeUnregisteredSession?.id ?? null,
              entryTime: activeUnregisteredSession?.entryTime ?? null,
            };
          })
          .sort((a, b) => Number(b.priority) - Number(a.priority) || a.code.localeCompare(b.code)),
      })),
    };
  }

  async registerMember(qrToken: string, userId: string, dto: { parkingSpaceId: string }) {
    const { qr, session } = await this.findRegisterableSession(qrToken, dto.parkingSpaceId);

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        vehicles: {
          include: { vehicle: true },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!user) throw new NotFoundException('User not found');

    const primaryVehicleLink = user.vehicles.find((v) => v.isPrimary) ?? user.vehicles[0];
    const vehicle = primaryVehicleLink?.vehicle ?? null;

    if (!vehicle) {
      throw new BadRequestException('No registered vehicle found for member');
    }

    return this.prisma.$transaction(async (tx) => {
      const current = await tx.parkingSession.findUnique({
        where: { id: session.id },
      });

      if (!current || current.isRegistered) {
        throw new BadRequestException('Parking space is already registered');
      }

      return tx.parkingSession.update({
        where: { id: session.id },
        data: {
          userId,
          vehicleId: vehicle.id,
          plateNumber: vehicle.plateNumber,
          contactPhone: user.phone,
          isRegistered: true,
          registeredAt: new Date(),
          registrationStatus: 'REGISTERED_BY_MEMBER' as any,
          registrationMethod: 'MEMBER_QR' as any,
          metadata: {
            ...((current.metadata as Prisma.JsonObject) ?? {}),
            qrToken: qr.qrToken,
            registeredFrom: 'MOBILE_QR_MEMBER',
          },
        },
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
          vehicle: true,
          user: true,
        },
      });
    });
  }

  async registerVisitor(
    qrToken: string,
    dto: {
      parkingSpaceId: string;
      phone: string;
      contactPhone?: string;
      vehiclePlateNumber: string;
      phoneVerificationCode?: string;
      phoneVerified?: boolean;
      verificationToken?: string;
      pinCode?: string;
    },
  ) {
    const phone = String(dto.phone ?? dto.contactPhone ?? '').trim();
    const vehiclePlateNumber = String(dto.vehiclePlateNumber ?? '').trim();
    const pinCode = String(dto.pinCode ?? '').trim();
    const hasPinCode = pinCode.length > 0;
    const visitorPhoneForPinReuse = String(
      dto.phone ?? dto.contactPhone ?? '',
    ).trim();
    const existingVisitorUser = visitorPhoneForPinReuse
      ? await this.prisma.user.findFirst({
          where: {
            phone: visitorPhoneForPinReuse,
          },
          include: {
            visitorProfile: true,
          },
        })
      : null;
    const canReuseExistingVisitorPin =
      (dto as any).phoneVerified === true &&
      Boolean(existingVisitorUser?.visitorProfile?.pinCodeHash);
    const phoneVerificationCode = String(dto.phoneVerificationCode ?? '').trim();

    if (!phone) throw new BadRequestException('phone is required');
    if (!vehiclePlateNumber) throw new BadRequestException('vehiclePlateNumber is required');

    if (phoneVerificationCode !== '123456' && dto.phoneVerified !== true) {
      throw new BadRequestException('phone verification is required');
    }

    if (hasPinCode && !/^\d{4,6}$/.test(pinCode)) {
      throw new BadRequestException('pinCode must be 4 to 6 digits');
    }

    if (!hasPinCode && !canReuseExistingVisitorPin) {
      throw new BadRequestException('pinCode must be 4 to 6 digits');
    }

    const pinCodeHash = hasPinCode
      ? await hash(pinCode, 10)
      : existingVisitorUser?.visitorProfile?.pinCodeHash ?? '';

    const { qr, session } = await this.findRegisterableSession(qrToken, dto.parkingSpaceId);

    return this.prisma.$transaction(async (tx) => {
      const current = await tx.parkingSession.findUnique({
        where: { id: session.id },
      });

      if (!current || current.isRegistered) {
        throw new BadRequestException('Parking space is already registered');
      }

      const visitorUser = await tx.user.upsert({
        where: { email: `visitor-${phone}@visitor.local` },
        create: {
          email: `visitor-${phone}@visitor.local`,
          passwordHash: 'VISITOR_TEMP',
          name: `Visitor ${phone}`,
          phone: phone,
          isApproved: true,
          status: 'ACTIVE',
          visitorProfile: {
            create: {
              phone: phone,
              vehicleNo: vehiclePlateNumber,
              phoneVerified: true,
              pinCodeHash,
              agreedAt: new Date(),
              lastAuthenticatedAt: new Date(),
            } as any,
          },
        },
        update: {
          phone: phone,
          visitorProfile: {
            upsert: {
              create: {
                phone: phone,
                vehicleNo: vehiclePlateNumber,
                phoneVerified: true,
                pinCodeHash,
                agreedAt: new Date(),
                lastAuthenticatedAt: new Date(),
              } as any,
              update: {
                phone: phone,
                vehicleNo: vehiclePlateNumber,
                phoneVerified: true,
                pinCodeHash,
                lastAuthenticatedAt: new Date(),
              } as any,
            },
          },
        },
        include: { visitorProfile: true },
      });

      return tx.parkingSession.update({
        where: { id: session.id },
        data: {
          userId: visitorUser.id,
          plateNumber: vehiclePlateNumber,
          contactPhone: phone,
          visitorProfileUserId: visitorUser.id,
          isRegistered: true,
          registeredAt: new Date(),
          registrationStatus: 'REGISTERED_BY_VISITOR' as any,
          registrationMethod: 'VISITOR_QR' as any,
          metadata: {
            ...((current.metadata as Prisma.JsonObject) ?? {}),
            qrToken: qr.qrToken,
            registeredFrom: 'MOBILE_QR_VISITOR',
            verificationToken: dto.verificationToken ?? null,
          },
        },
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
          user: true,
        },
      });
    });
  }

  private async findRegisterableSession(qrToken: string, parkingSpaceId: string) {
    const qr = await this.prisma.parkingLotQr.findUnique({
      where: { qrToken },
      include: { parkingLot: { include: { sections: true } } },
    });

    if (!qr || !qr.isActive) {
      throw new NotFoundException('Invalid or inactive QR code');
    }

    const space = await this.prisma.parkingSpace.findFirst({
      where: {
        id: parkingSpaceId,
        section: { parkingLotId: qr.parkingLotId },
      },
      include: {
        sessions: {
          where: {
            status: { in: ['ACTIVE', 'GRACE_PERIOD', 'CREATED'] as any },
            isRegistered: false,
          },
          orderBy: { entryTime: 'desc' },
          take: 1,
        },
      },
    });

    if (!space) throw new NotFoundException('Parking space not found for this QR');

    const session = space.sessions[0];

    if (!session) {
      throw new BadRequestException('No unregistered active parking session found for this space');
    }

    return { qr, space, session };
  }
}
