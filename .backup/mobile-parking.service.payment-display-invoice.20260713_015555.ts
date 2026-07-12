import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, SessionStatus, SpaceStatus, Vehicle } from '@parking/db';
import { PrismaService } from '../../prisma/prisma.service';
import { RegisterOccupiedSpaceDto } from './dto/register-occupied-space.dto';

@Injectable()
export class MobileParkingService {
  constructor(private readonly prisma: PrismaService) {}

  async getMyCurrentSession(userId: string) {
    return this.prisma.parkingSession.findFirst({
      where: {
        userId,
        status: {
          in: [
            SessionStatus.ACTIVE,
            SessionStatus.GRACE_PERIOD,
            SessionStatus.CLOSED,
          ],
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      include: {
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
      },
    });
  }

  async listMySessions(userId: string) {
    return this.prisma.parkingSession.findMany({
      where: { userId },
      orderBy: {
        createdAt: 'desc',
      },
      take: 100,
      include: {
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
      },
    });
  }

  async registerOccupiedSpace(userId: string, dto: RegisterOccupiedSpaceDto) {
    const space = await this.prisma.parkingSpace.findUnique({
      where: { id: dto.parkingSpaceId },
      include: {
        sessions: {
          where: {
            status: SessionStatus.ACTIVE,
          },
          orderBy: {
            createdAt: 'desc',
          },
          take: 1,
        },
      },
    });

    if (!space) {
      throw new NotFoundException('Parking space not found');
    }

    if (space.status !== SpaceStatus.OCCUPIED) {
      throw new BadRequestException('This parking space is not currently occupied');
    }

    const activeSession = space.sessions[0];

    if (!activeSession) {
      throw new BadRequestException('No active sensor session found for this space');
    }

    if (activeSession.userId && activeSession.userId !== userId) {
      throw new BadRequestException('This occupied session is already registered by another user');
    }

    if (activeSession.userId === userId) {
      return this.prisma.parkingSession.findUnique({
        where: { id: activeSession.id },
        include: {
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
        },
      });
    }

    let vehicle: Vehicle | null = null;

    if (dto.vehicleId) {
      vehicle = await this.prisma.vehicle.findUnique({
        where: { id: dto.vehicleId },
      });

      if (!vehicle) {
        throw new NotFoundException('Vehicle not found');
      }
    } else if (dto.plateNumber) {
      vehicle = await this.prisma.vehicle.upsert({
        where: { plateNumber: dto.plateNumber },
        update: {},
        create: {
          plateNumber: dto.plateNumber,
          isActive: true,
        },
      });
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const session = await tx.parkingSession.update({
        where: { id: activeSession.id },
        data: {
          userId,
          vehicleId: vehicle?.id ?? activeSession.vehicleId,
          registeredAt: new Date(),
          metadata: {
            ...(activeSession.metadata &&
            typeof activeSession.metadata === 'object'
              ? (activeSession.metadata as Record<string, unknown>)
              : {}),
            registrationStatus: 'REGISTERED',
            registrationSource: 'mobile',
          } as any,
        },
        include: {
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
        },
      });

      await tx.parkingSessionEvent.create({
        data: {
          sessionId: session.id,
          type: 'parking.registered.after_entry',
          source: 'mobile',
          payload: {
            userId,
            vehicleId: vehicle?.id ?? null,
            parkingSpaceId: dto.parkingSpaceId,
          } as any,
        },
      });

      await tx.domainEvent.create({
        data: {
          eventId: crypto.randomUUID(),
          aggregateType: 'ParkingSession',
          aggregateId: session.id,
          eventType: 'parking.session_registered_after_entry',
          payload: {
            sessionId: session.id,
            userId,
            vehicleId: vehicle?.id ?? null,
            parkingSpaceId: dto.parkingSpaceId,
          } as any,
          occurredAt: new Date(),
        },
      });

      return session;
    });

    return updated;
  }
  private getJwtUserId(jwtUser: any) {
    const userId = jwtUser?.sub ?? jwtUser?.userId ?? jwtUser?.id;
    if (!userId) {
      throw new BadRequestException('Invalid mobile token');
    }
    return String(userId);
  }

  async getCurrentParking(jwtUser: any, sessionId?: string) {
    const userId = this.getJwtUserId(jwtUser);
    const roles = Array.isArray(jwtUser?.roles) ? jwtUser.roles : [];
    const profileType = jwtUser?.profileType;

    const isVisitor = profileType === 'VISITOR' || roles.includes('VISITOR');

    const include = {
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
      visitorProfile: true,
      invoice: {
        include: {
          payments: true,
        },
      },
    } satisfies Prisma.ParkingSessionInclude;

    type CurrentParkingSession = Prisma.ParkingSessionGetPayload<{
      include: typeof include;
    }>;

    const session: CurrentParkingSession | null =
      await this.prisma.parkingSession.findFirst({
        where: {
          ...(sessionId ? { id: sessionId } : {}),
          ...(isVisitor
            ? { visitorProfileUserId: userId }
            : { userId }),
          status: {
            in: [
              SessionStatus.ACTIVE,
              SessionStatus.GRACE_PERIOD,
            ],
          },
          exitTime: null,
        },
        orderBy: {
          entryTime: 'desc',
        },
        include,
      });

    if (!session) {
      return {
        current: null,
      };
    }

    const parkingSpace = session.ParkingSpace;
    const section = parkingSpace?.section;
    const parkingLot = section?.parkingLot;

    return {
      current: {
        id: session.id,
        sessionNo: session.sessionNo,
        status: session.status,
        isRegistered: session.isRegistered,
        entryTime: session.entryTime,
        exitTime: session.exitTime,
        registeredAt: session.registeredAt,
        plateNumber: session.plateNumber,
        contactPhone: session.contactPhone,
        registrationStatus: session.registrationStatus,
        registrationMethod: session.registrationMethod,
        parkingLot: parkingLot
          ? {
              id: parkingLot.id,
              name: parkingLot.name,
              code: parkingLot.code,
              address: parkingLot.address,
              region: parkingLot.region,
              sido: parkingLot.region,
              sigungu: parkingLot.district,
            }
          : null,
        section: section
          ? {
              id: section.id,
              name: section.name,
              code: section.code,
            }
          : null,
        parkingSpace: parkingSpace
          ? {
              id: parkingSpace.id,
              code: parkingSpace.code,
              number: parkingSpace.number,
              status: parkingSpace.status,
            }
          : null,
        vehicle: session.vehicle
          ? {
              id: session.vehicle.id,
              plateNumber: session.vehicle.plateNumber,
              vehicleType: session.vehicle.vehicleType,
            }
          : null,
        invoice: session.invoice
          ? {
              id: session.invoice.id,
              status: session.invoice.status,
              amount: session.invoice.amount,
              paidAmount: session.invoice.paidAmount,
              payments: session.invoice.payments,
            }
          : null,
      },
    };
  }

  async listPayments(jwtUser: any) {
    const userId = this.getJwtUserId(jwtUser);
    const roles = Array.isArray(jwtUser?.roles) ? jwtUser.roles : [];
    const profileType = jwtUser?.profileType;
    const isVisitor = profileType === 'VISITOR' || roles.includes('VISITOR');

    const include = {
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
          payments: {
            orderBy: {
              createdAt: 'desc',
            },
          },
        },
      },
    } satisfies Prisma.ParkingSessionInclude;

    type PaymentSession = Prisma.ParkingSessionGetPayload<{
      include: typeof include;
    }>;

    const sessions: PaymentSession[] = await this.prisma.parkingSession.findMany({
      where: {
        ...(isVisitor
          ? { visitorProfileUserId: userId }
          : { userId }),
      },
      orderBy: {
        entryTime: 'desc',
      },
      take: 50,
      include,
    });

    return {
      items: sessions.map((session) => {
        const parkingSpace = session.ParkingSpace;
        const section = parkingSpace?.section;
        const parkingLot = section?.parkingLot;

        return {
          id: session.id,
          sessionNo: session.sessionNo,
          status: session.status,
          entryTime: session.entryTime,
          exitTime: session.exitTime,
          plateNumber: session.plateNumber ?? session.vehicle?.plateNumber ?? null,
          registrationMethod: session.registrationMethod,
          parkingLot: parkingLot
            ? {
                id: parkingLot.id,
                name: parkingLot.name,
                address: parkingLot.address,
                region: parkingLot.region,
              }
            : null,
          section: section
            ? {
                id: section.id,
                name: section.name,
                code: section.code,
              }
            : null,
          parkingSpace: parkingSpace
            ? {
                id: parkingSpace.id,
                code: parkingSpace.code,
                number: parkingSpace.number,
              }
            : null,
          invoice: session.invoice
            ? {
                id: session.invoice.id,
                status: session.invoice.status,
                amount: session.invoice.amount,
                paidAmount: session.invoice.paidAmount,
                issuedAt: session.invoice.issuedAt,
                dueAt: session.invoice.dueAt,
                payments: session.invoice.payments,
              }
            : null,
        };
      }),
    };
  }

  private diffMinutes(start?: Date | null, end?: Date | null) {
    if (!start || !end) {
      return 0;
    }

    return Math.max(
      0,
      Math.ceil((end.getTime() - start.getTime()) / 60000),
    );
  }

  private isSelfRegistrationMethod(method?: string | null) {
    return method === 'MEMBER_QR' || method === 'VISITOR_QR';
  }

  private isWatcherRegistrationMethod(method?: string | null) {
    return method === 'WATCHER_PROXY' || method === 'WATCHER_AUTHORITY';
  }

  private calculateBaseParkingAmount(totalMinutes: number, feePolicy: any) {
    const graceMinutes = Number(feePolicy?.graceMinutes ?? 0);
    const baseMinutes = Math.max(0, Number(feePolicy?.baseMinutes ?? 0));
    const baseFee = Math.max(0, Number(feePolicy?.baseFee ?? 0));
    const unitMinutes = Math.max(1, Number(feePolicy?.unitMinutes ?? 1));
    const unitFee = Math.max(0, Number(feePolicy?.unitFee ?? 0));
    const dailyMax = feePolicy?.dailyMax == null ? null : Number(feePolicy.dailyMax);

    if (totalMinutes <= graceMinutes) {
      return 0;
    }

    if (totalMinutes <= baseMinutes) {
      return baseFee;
    }

    const calculateSingleDayAmount = (minutes: number) => {
      if (minutes <= graceMinutes) {
        return 0;
      }

      if (minutes <= baseMinutes) {
        return baseFee;
      }

      const extraMinutes = minutes - baseMinutes;
      const extraUnits = Math.ceil(extraMinutes / unitMinutes);
      const amount = baseFee + extraUnits * unitFee;

      if (dailyMax !== null && dailyMax > 0) {
        return Math.min(amount, dailyMax);
      }

      return amount;
    };

    if (dailyMax !== null && dailyMax > 0) {
      const minutesPerDay = 24 * 60;
      const fullDays = Math.floor(totalMinutes / minutesPerDay);
      const remainingMinutes = totalMinutes % minutesPerDay;

      return fullDays * dailyMax + calculateSingleDayAmount(remainingMinutes);
    }

    return calculateSingleDayAmount(totalMinutes);
  }

  private calculateRegistrationGraceDiscount(session: any, feePolicy: any) {
    const method = String(session?.registrationMethod ?? '');
    const isSelfRegistration = this.isSelfRegistrationMethod(method);

    if (!isSelfRegistration) {
      return 0;
    }

    if (!feePolicy?.registrationGraceDiscountEnabled) {
      return 0;
    }

    const registeredMinutes = this.diffMinutes(
      session?.entryTime,
      session?.registeredAt,
    );

    const registrationGraceMinutes = Number(
      feePolicy?.registrationGraceMinutes ?? 0,
    );

    if (!session?.registeredAt || registeredMinutes > registrationGraceMinutes) {
      return 0;
    }

    return Math.max(0, Number(feePolicy?.registrationGraceFee ?? 0));
  }

  private calculateWatcherRewardBasis(session: any, feePolicy: any) {
    const method = String(session?.registrationMethod ?? '');

    if (!this.isWatcherRegistrationMethod(method)) {
      return 0;
    }

    if (!feePolicy?.watcherRewardGraceFeeEnabled) {
      return 0;
    }

    return Math.max(0, Number(feePolicy?.registrationGraceFee ?? 0));
  }

  async previewCurrentFee(jwtUser: any, sessionId?: string) {
    const userId = this.getJwtUserId(jwtUser);
    const roles = Array.isArray(jwtUser?.roles) ? jwtUser.roles : [];
    const profileType = jwtUser?.profileType;
    const isVisitor = profileType === 'VISITOR' || roles.includes('VISITOR');

    const include = {
      feePolicy: true,
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
    } satisfies Prisma.ParkingSessionInclude;

    type CurrentFeeSession = Prisma.ParkingSessionGetPayload<{
      include: typeof include;
    }>;

    const session: CurrentFeeSession | null =
      await this.prisma.parkingSession.findFirst({
        where: {
          ...(sessionId ? { id: sessionId } : {}),
          ...(isVisitor
            ? { visitorProfileUserId: userId }
            : { userId }),
          status: {
            in: [
              SessionStatus.ACTIVE,
              SessionStatus.GRACE_PERIOD,
            ],
          },
          exitTime: null,
        },
        orderBy: {
          entryTime: 'desc',
        },
        include,
      });

    if (!session) {
      return {
        current: null,
        fee: null,
      };
    }

    const parkingLotId = session.ParkingSpace?.section?.parkingLot?.id;
    const vehicleType = session.feePolicy?.vehicleType ?? 'GENERAL';

    const feePolicy =
      session.feePolicy ??
      (parkingLotId
        ? await this.prisma.feePolicy.findFirst({
            where: {
              parkingLotId,
              isActive: true,
              vehicleType,
            },
            orderBy: {
              createdAt: 'desc',
            },
          })
        : null) ??
      (parkingLotId
        ? await this.prisma.feePolicy.findFirst({
            where: {
              parkingLotId,
              isActive: true,
            },
            orderBy: {
              createdAt: 'desc',
            },
          })
        : null);

    if (!feePolicy) {
      throw new BadRequestException('Active fee policy not found');
    }

    const now = new Date();
    const totalMinutes = this.diffMinutes(session.entryTime, session.exitTime ?? now);
    const baseParkingAmount = this.calculateBaseParkingAmount(
      totalMinutes,
      feePolicy,
    );
    const registrationGraceDiscountAmount =
      this.calculateRegistrationGraceDiscount(session, feePolicy);
    const watcherRewardBasisAmount =
      this.calculateWatcherRewardBasis(session, feePolicy);

    const finalAmount = Math.max(
      0,
      baseParkingAmount - registrationGraceDiscountAmount,
    );

    return {
      current: {
        id: session.id,
        sessionNo: session.sessionNo,
        status: session.status,
        entryTime: session.entryTime,
        exitTime: session.exitTime,
        registeredAt: session.registeredAt,
        registrationMethod: session.registrationMethod,
        plateNumber: session.plateNumber ?? session.vehicle?.plateNumber ?? null,
        parkingLot: session.ParkingSpace?.section?.parkingLot
          ? {
              id: session.ParkingSpace.section.parkingLot.id,
              name: session.ParkingSpace.section.parkingLot.name,
            }
          : null,
        parkingSpace: session.ParkingSpace
          ? {
              id: session.ParkingSpace.id,
              code: session.ParkingSpace.code,
            }
          : null,
      },
      fee: {
        totalMinutes,
        baseParkingAmount,
        registrationGraceDiscountAmount,
        watcherRewardBasisAmount,
        finalAmount,
        policy: {
          id: feePolicy.id,
          name: feePolicy.name,
          code: feePolicy.code,
          baseMinutes: feePolicy.baseMinutes,
          baseFee: feePolicy.baseFee,
          unitMinutes: feePolicy.unitMinutes,
          unitFee: feePolicy.unitFee,
          dailyMax: feePolicy.dailyMax,
          graceMinutes: feePolicy.graceMinutes,
          registrationGraceMinutes: feePolicy.registrationGraceMinutes,
          registrationGraceFee: feePolicy.registrationGraceFee,
          registrationGraceDiscountEnabled:
            feePolicy.registrationGraceDiscountEnabled,
          authorityRegistrationGraceDiscountEnabled:
            feePolicy.authorityRegistrationGraceDiscountEnabled,
          watcherRewardGraceFeeEnabled:
            feePolicy.watcherRewardGraceFeeEnabled,
        },
      },
    };
  }

  async finalizeCurrentInvoice(jwtUser: any, sessionId?: string) {
    const userId = this.getJwtUserId(jwtUser);
    const roles = Array.isArray(jwtUser?.roles) ? jwtUser.roles : [];
    const profileType = jwtUser?.profileType;
    const isVisitor = profileType === 'VISITOR' || roles.includes('VISITOR');

    let session = await this.prisma.parkingSession.findFirst({
      where: {
        ...(sessionId ? { id: sessionId } : {}),
        ...(isVisitor
          ? { visitorProfileUserId: userId }
          : { userId }),
        status: {
          in: [
            SessionStatus.ACTIVE,
            SessionStatus.GRACE_PERIOD,
          ],
        },
        exitTime: null,
      },
      orderBy: {
        entryTime: 'desc',
      },
      select: {
        id: true,
      },
    });

    if (!session && sessionId) {
      session = await this.prisma.parkingSession.findFirst({
        where: {
          id: sessionId,
          status: {
            in: [
              SessionStatus.ACTIVE,
              SessionStatus.GRACE_PERIOD,
            ],
          },
          exitTime: null,
        },
        select: {
          id: true,
        },
      });
    }

    if (!session) {
      throw new NotFoundException('Current parking session not found');
    }

    return this.finalizeInvoiceForSessionId(session.id);
  }

  async finalizeInvoiceForSessionId(sessionId: string, options?: { exitTime?: Date }) {
    const include = {
      feePolicy: true,
      vehicle: true,
      invoice: true,
      ParkingSpace: {
        include: {
          section: {
            include: {
              parkingLot: true,
            },
          },
        },
      },
    } satisfies Prisma.ParkingSessionInclude;

    type FinalizeSessionById = Prisma.ParkingSessionGetPayload<{
      include: typeof include;
    }>;

    const session: FinalizeSessionById | null =
      await this.prisma.parkingSession.findUnique({
        where: {
          id: sessionId,
        },
        include,
      });

    if (!session) {
      throw new NotFoundException('Parking session not found');
    }

    const parkingLotId = session.ParkingSpace?.section?.parkingLot?.id;
    const vehicleType = session.feePolicy?.vehicleType ?? 'GENERAL';

    const feePolicy =
      session.feePolicy ??
      (parkingLotId
        ? await this.prisma.feePolicy.findFirst({
            where: {
              parkingLotId,
              isActive: true,
              vehicleType,
            },
            orderBy: {
              createdAt: 'desc',
            },
          })
        : null) ??
      (parkingLotId
        ? await this.prisma.feePolicy.findFirst({
            where: {
              parkingLotId,
              isActive: true,
            },
            orderBy: {
              createdAt: 'desc',
            },
          })
        : null);

    if (!feePolicy) {
      throw new BadRequestException('Active fee policy not found');
    }

    const exitTime = options?.exitTime ?? session.exitTime ?? new Date();
    const totalMinutes = this.diffMinutes(session.entryTime, exitTime);

    const baseParkingAmount = this.calculateBaseParkingAmount(
      totalMinutes,
      feePolicy,
    );

    const registrationGraceDiscountAmount =
      this.calculateRegistrationGraceDiscount(session, feePolicy);

    const watcherRewardBasisAmount =
      this.calculateWatcherRewardBasis(session, feePolicy);

    const finalAmount = Math.max(
      0,
      baseParkingAmount - registrationGraceDiscountAmount,
    );

    const sessionInvoices = await this.prisma.invoice.findMany({
      where: {
        sessionId: session.id,
      },
      orderBy: {
        createdAt: 'asc',
      },
    });

    const paidInvoices = sessionInvoices.filter(
      (item) => item.status === 'PAID',
    );

    const alreadyPaidAmount = paidInvoices.reduce(
      (sum, item) => sum + Number(item.paidAmount ?? 0),
      0,
    );

    const paidBaseInvoice =
      paidInvoices.find((item) => {
        const metadata = (item.metadata as any) ?? {};
        return metadata.invoiceKind === 'PARKING_FEE' || !metadata.invoiceKind;
      }) ??
      session.invoice ??
      null;

    const additionalFeeAmount = Math.max(0, finalAmount - alreadyPaidAmount);
    const shouldCreateAdditionalFee =
      alreadyPaidAmount > 0 && additionalFeeAmount > 0;

    const unpaidAdditionalInvoice = sessionInvoices.find((item) => {
      const metadata = (item.metadata as any) ?? {};

      return (
        metadata.invoiceKind === 'ADDITIONAL_FEE' &&
        !['PAID', 'VOID', 'CANCELLED'].includes(String(item.status))
      );
    });

    const paidAmount = shouldCreateAdditionalFee ? 0 : alreadyPaidAmount;
    const unpaidAmount = shouldCreateAdditionalFee
      ? additionalFeeAmount
      : Math.max(0, finalAmount - alreadyPaidAmount);
    const previousUnpaidAmount = unpaidAdditionalInvoice?.unpaidAmount ?? 0;
    const isAdditionalFeeInvoice = shouldCreateAdditionalFee;
    const invoiceTitle = isAdditionalFeeInvoice
      ? '추가 요금 청구서'
      : '주차 요금 청구서';
    const invoiceKind = isAdditionalFeeInvoice
      ? 'ADDITIONAL_FEE'
      : 'PARKING_FEE';
    const invoiceStatus =
      unpaidAmount > 0 ? ('ISSUED' as const) : ('PAID' as const);
    const invoicePaidAt = unpaidAmount <= 0 ? new Date() : null;

    const invoiceNo = isAdditionalFeeInvoice
      ? (unpaidAdditionalInvoice?.invoiceNo ??
        `ADD-${Date.now()}-${session.sessionNo ?? session.id}`)
      : (session.invoice?.invoiceNo ??
        `INV-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${session.sessionNo}`);

    const pricingSnapshot = {
      totalMinutes,
      baseParkingAmount,
      directRegistrationDiscountAmount: registrationGraceDiscountAmount,
      registrationGraceDiscountAmount,
      watcherRewardBasisAmount,
      finalAmount,
      paidAmount,
      unpaidAmount,
      previousUnpaidAmount,
      invoiceTitle,
      invoiceKind,
      isAdditionalFeeInvoice,
      additionalFeeAmount: isAdditionalFeeInvoice ? unpaidAmount : 0,
      policy: {
        id: feePolicy.id,
        code: feePolicy.code,
        name: feePolicy.name,
        baseMinutes: feePolicy.baseMinutes,
        baseFee: feePolicy.baseFee,
        unitMinutes: feePolicy.unitMinutes,
        unitFee: feePolicy.unitFee,
        dailyMax: feePolicy.dailyMax,
        graceMinutes: feePolicy.graceMinutes,
        exitGraceMinutes: feePolicy.exitGraceMinutes,
        registrationGraceMinutes: feePolicy.registrationGraceMinutes,
        registrationGraceFee: feePolicy.registrationGraceFee,
        registrationGraceDiscountEnabled:
          feePolicy.registrationGraceDiscountEnabled,
        authorityRegistrationGraceDiscountEnabled:
          feePolicy.authorityRegistrationGraceDiscountEnabled,
        watcherRewardGraceFeeEnabled:
          feePolicy.watcherRewardGraceFeeEnabled,
      },
      session: {
        id: session.id,
        sessionNo: session.sessionNo,
        entryTime: session.entryTime,
        exitTime,
        registeredAt: session.registeredAt,
        registrationMethod: session.registrationMethod,
      },
    };

    const invoice = shouldCreateAdditionalFee
      ? unpaidAdditionalInvoice
        ? await this.prisma.invoice.update({
            where: {
              id: unpaidAdditionalInvoice.id,
            },
            data: {
              status: 'ISSUED',
              amount: additionalFeeAmount,
              discountAmount: 0,
              paidAmount: 0,
              unpaidAmount: additionalFeeAmount,
              baseParkingAmount: additionalFeeAmount,
              registrationGraceDiscountAmount: 0,
              authorityRegistrationSurchargeAmount: 0,
              watcherRewardBasisAmount: 0,
              finalAmount: additionalFeeAmount,
              issuedAt: unpaidAdditionalInvoice.issuedAt ?? new Date(),
              paidAt: null,
              metadata: {
                ...((unpaidAdditionalInvoice.metadata as any) ?? {}),
                ...(pricingSnapshot as any),
                invoiceTitle: '추가 요금 청구서',
                invoiceKind: 'ADDITIONAL_FEE',
                isAdditionalFeeInvoice: true,
                additionalFeeAmount,
                totalParkingAmount: finalAmount,
                alreadyPaidAmount,
                billingPeriodStartAt:
                  paidBaseInvoice?.paidAt ??
                  paidBaseInvoice?.updatedAt ??
                  new Date(),
                billingPeriodStartSource: 'PREVIOUS_INVOICE_PAID_AT',
                displayEntryTime:
                  paidBaseInvoice?.paidAt ??
                  paidBaseInvoice?.updatedAt ??
                  new Date(),
              } as any,
            },
          })
        : await this.prisma.invoice.create({
            data: {
              invoiceNo,
              sessionId: session.id,
              status: 'ISSUED',
              amount: additionalFeeAmount,
              discountAmount: 0,
              paidAmount: 0,
              unpaidAmount: additionalFeeAmount,
              baseParkingAmount: additionalFeeAmount,
              registrationGraceDiscountAmount: 0,
              authorityRegistrationSurchargeAmount: 0,
              watcherRewardBasisAmount: 0,
              finalAmount: additionalFeeAmount,
              issuedAt: new Date(),
              dueAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
              paidAt: null,
              metadata: {
                ...(pricingSnapshot as any),
                invoiceTitle: '추가 요금 청구서',
                invoiceKind: 'ADDITIONAL_FEE',
                isAdditionalFeeInvoice: true,
                additionalFeeAmount,
                totalParkingAmount: finalAmount,
                alreadyPaidAmount,
                billingPeriodStartAt:
                  paidBaseInvoice?.paidAt ??
                  paidBaseInvoice?.updatedAt ??
                  new Date(),
                billingPeriodStartSource: 'PREVIOUS_INVOICE_PAID_AT',
                displayEntryTime:
                  paidBaseInvoice?.paidAt ??
                  paidBaseInvoice?.updatedAt ??
                  new Date(),
              } as any,
            },
          })
      : session.invoice
        ? await this.prisma.invoice.update({
            where: {
              id: session.invoice.id,
            },
            data: {
              status: invoiceStatus,
              amount: finalAmount,
              discountAmount: registrationGraceDiscountAmount,
              paidAmount: alreadyPaidAmount,
              unpaidAmount,
              baseParkingAmount,
              registrationGraceDiscountAmount,
              authorityRegistrationSurchargeAmount: 0,
              watcherRewardBasisAmount,
              finalAmount,
              issuedAt: session.invoice.issuedAt ?? new Date(),
              paidAt: invoicePaidAt,
              metadata: pricingSnapshot as any,
            },
          })
        : await this.prisma.invoice.create({
            data: {
              invoiceNo,
              sessionId: session.id,
              status: invoiceStatus,
              amount: finalAmount,
              discountAmount: registrationGraceDiscountAmount,
              paidAmount: alreadyPaidAmount,
              unpaidAmount,
              baseParkingAmount,
              registrationGraceDiscountAmount,
              authorityRegistrationSurchargeAmount: 0,
              watcherRewardBasisAmount,
              finalAmount,
              issuedAt: new Date(),
              paidAt: invoicePaidAt,
              metadata: pricingSnapshot as any,
            },
          });


    const updatedSession = await this.prisma.parkingSession.update({
      where: {
        id: session.id,
      },
      data: {
        exitTime: options?.exitTime ? exitTime : session.exitTime,
        totalMinutes,
        amount: finalAmount,
        paidAmount: alreadyPaidAmount,
        unpaidAmount: shouldCreateAdditionalFee ? additionalFeeAmount : unpaidAmount,
        feePolicyId: feePolicy.id,
        billingClosedAt: options?.exitTime ? new Date() : session.billingClosedAt,
        primaryInvoiceId: isAdditionalFeeInvoice
          ? (session.primaryInvoiceId ?? paidBaseInvoice?.id ?? null)
          : invoice.id,
      },
      include: {
        },
    });

    return {
      session: updatedSession,
      invoice,
      calculation: {
        totalMinutes,
        baseParkingAmount,
        directRegistrationDiscountAmount: registrationGraceDiscountAmount,
        registrationGraceDiscountAmount,
        watcherRewardBasisAmount,
        finalAmount,
        paidAmount,
        unpaidAmount,
      },
    };
  }

}