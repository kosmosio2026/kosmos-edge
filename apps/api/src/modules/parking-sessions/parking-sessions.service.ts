import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { SessionStatus } from '@parking/db';
import { PrismaService } from '../../prisma/prisma.service';
import type { AuthUser } from '../../common/types/auth-user.type';

type GetSessionsParams = {
  user?: AuthUser;
  parkingLotId?: string;
  status?: string;
};

type RegisterSessionInput = {
  plateNumber?: string | null;
  contactNumber?: string | null;
};

function getUserRoles(user?: AuthUser | null): string[] {
  const raw = (user as any)?.roles ?? (user as any)?.role ?? [];
  if (Array.isArray(raw)) return raw.map(String);
  if (raw) return [String(raw)];
  return [];
}

function isAdmin(user?: AuthUser | null) {
  return getUserRoles(user).includes('ADMIN');
}

function isManager(user?: AuthUser | null) {
  return getUserRoles(user).includes('MANAGER');
}

function isOperator(user?: AuthUser | null) {
  return getUserRoles(user).includes('OPERATOR');
}

@Injectable()
export class ParkingSessionsService {
  constructor(private readonly prisma: PrismaService) {}

  async getRecentEvents(params: { limit?: number } = {}) {
    const limit = Math.min(Math.max(Number(params.limit ?? 10), 1), 30);

    const events = await this.prisma.parkingSessionEvent.findMany({
      where: {
        type: {
          in: [
            'parking.session.manual_registered',
            'parking.session.manual_payment_registered',
            'parking.session.registration_photo_added',
          ],
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: limit,
      include: {
        session: {
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
    });

    return {
      ok: true,
      items: events.map((event) => ({
        id: event.id,
        type: event.type,
        source: event.source,
        payload: event.payload,
        createdAt: event.createdAt,
        session: {
          id: event.session.id,
          sessionNo: event.session.sessionNo,
          plateNumber: event.session.plateNumber,
          contactPhone: event.session.contactPhone,
          parkingLotName:
            event.session.ParkingSpace?.section?.parkingLot?.name ??
            event.session.ParkingSpace?.section?.parkingLot?.code ??
            null,
          sectionName:
            event.session.ParkingSpace?.section?.name ??
            event.session.ParkingSpace?.section?.code ??
            null,
          parkingSpaceCode: event.session.ParkingSpace?.code ?? null,
        },
      })),
    };
  }

  private async getOperatorSessionScopeWhere(user?: AuthUser) {
    if (!user?.sub || isAdmin(user)) {
      return {};
    }

    if (isManager(user)) {
      const rows = await this.prisma.managerParkingLot.findMany({
        where: {
          managerProfileUserId: user.sub,
        },
        select: {
          parkingLotId: true,
        },
      });

      return {
        ParkingSpace: {
          section: {
            parkingLotId: {
              in: rows.map((row) => row.parkingLotId),
            },
          },
        },
      };
    }

    if (isOperator(user)) {
      const rows = await this.prisma.operatorParkingSection.findMany({
        where: {
          operatorProfileUserId: user.sub,
        },
        select: {
          sectionId: true,
        },
      });

      return {
        ParkingSpace: {
          sectionId: {
            in: rows.map((row) => row.sectionId),
          },
        },
      };
    }

    return {};
  }

  private async calculateExpectedFeeForSession(session: any) {
    const entryTime = session.entryTime ? new Date(session.entryTime) : null;
    if (!entryTime || Number.isNaN(entryTime.getTime())) return 0;

    const totalMinutes = Math.max(
      0,
      Math.ceil((Date.now() - entryTime.getTime()) / 60000),
    );

    const baseMinutes = 30;
    const baseFee = 1000;
    const unitMinutes = 10;
    const unitFee = 500;
    const dailyMax = 20000;

    const oneDayFee = (minutes: number) => {
      if (minutes <= 0) return 0;
      if (minutes <= baseMinutes) return baseFee;

      const amount =
        baseFee + Math.ceil((minutes - baseMinutes) / unitMinutes) * unitFee;

      return Math.min(amount, dailyMax);
    };

    const fullDays = Math.floor(totalMinutes / 1440);
    const rest = totalMinutes % 1440;

    return fullDays * dailyMax + oneDayFee(rest);
  }

  async getSessions(params: GetSessionsParams = {}) {
    const { user, parkingLotId, status } = params;
    const scopeWhere = await this.getOperatorSessionScopeWhere(user);

    const normalizedStatus = status?.trim().toUpperCase();
    const sessionStatusWhere =
      !normalizedStatus || normalizedStatus === 'ACTIVE'
        ? { status: SessionStatus.ACTIVE }
        : normalizedStatus === 'ALL'
          ? {}
          : normalizedStatus === 'HISTORY'
            ? { status: { not: SessionStatus.ACTIVE } }
            : { status: normalizedStatus as SessionStatus };

    const sessions = await this.prisma.parkingSession.findMany({
      where: {
        ...sessionStatusWhere,
        ...(parkingLotId
          ? {
              ParkingSpace: {
                section: {
                  parkingLotId,
                },
              },
            }
          : {}),
      },
      orderBy: {
        createdAt: 'desc',
      },
      include: {
        user: true,
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
        feePolicy: true,
        invoice: {
          include: {
            manualPayments: {
              orderBy: {
                collectedAt: 'desc',
              },
              include: {
                collectedBy: {
                  select: {
                    id: true,
                    name: true,
                    email: true,
                  },
                },
              },
            },
          },
        },
        registrationPhotos: {
          orderBy: {
            createdAt: 'desc',
          },
        },
      },
    });

      const scopedSectionIds =
        ((scopeWhere as any).ParkingSpace?.sectionId?.in as string[] | undefined) ?? null;
      const scopedParkingLotIds =
        ((scopeWhere as any).ParkingSpace?.section?.parkingLotId?.in as string[] | undefined) ?? null;

      const visibleSessions = sessions.filter((session) => {
        if (Array.isArray(scopedSectionIds)) {
          return scopedSectionIds.includes(session.ParkingSpace?.sectionId ?? '');
        }

        if (Array.isArray(scopedParkingLotIds)) {
          return scopedParkingLotIds.includes(session.ParkingSpace?.section?.parkingLotId ?? '');
        }

        return true;
      });


    const result = await Promise.all(
      visibleSessions.map(async (session) => {
        const sensorDevice = session.ParkingSpace?.id
          ? await this.prisma.sensorDevice.findFirst({
              where: {
                parkingSpaceId: session.ParkingSpace.id,
              },
              orderBy: {
                createdAt: 'desc',
              },
            })
          : null;

        const devEui = sensorDevice?.devEui ?? null;

        const latestSensorData = devEui
          ? await this.prisma.parking_sensor_data.findFirst({
              where: {
                dev_eui: devEui,
              },
              orderBy: {
                time: 'desc',
              },
              select: {
                dev_eui: true,
                parking_status: true,
                device_status: true,
                battery_status: true,
                time: true,
              },
            })
          : null;

        const metadata = (session.metadata ?? {}) as any;
        const latestInvoice = session.invoice ?? null;
        let accruedFeeAmount: number | null = null;
        if (session.status === SessionStatus.ACTIVE) {
          try {
            accruedFeeAmount = await this.calculateExpectedFeeForSession(session);
          } catch (error) {
            console.error('[parking-sessions] expected fee calculation failed', error);
            accruedFeeAmount = 0;
          }
        }
        const billedAmount = Number(
          latestInvoice?.amount ?? session.amount ?? 0,
        );
        const paidAmount = Number(
          latestInvoice?.paidAmount ?? session.paidAmount ?? 0,
        );
        const unpaidAmount = Number(
          latestInvoice?.unpaidAmount ?? session.unpaidAmount ?? 0,
        );
        const unpaidFee = Number(
          latestInvoice?.unpaidAmount ?? session.unpaidAmount ?? 0,
        );

        return {
          id: session.id,
          sessionNo: session.sessionNo,

          plateNumber:
            session.vehicle?.plateNumber ?? session.plateNumber ?? null,

          contactNumber:
            session.user?.phone ??
            metadata.contactNumber ??
            metadata.contact ??
            null,

          user: session.user
            ? {
                id: session.user.id,
                name: session.user.name,
                email: session.user.email,
                phone: session.user.phone,
              }
            : null,

          status: session.status,
          entryTime: session.entryTime,
          exitTime: session.exitTime,
          amount: billedAmount,
          billedAmount,
          paidAmount,
          unpaidAmount,
          unpaidFee,
          accruedFeeAmount,
          expectedFee: accruedFeeAmount,
          estimatedFee: accruedFeeAmount,
          sectionCode: session.ParkingSpace?.section?.code ?? null,
          parkingSectionCode: session.ParkingSpace?.section?.code ?? null,
          latestInvoice: latestInvoice
            ? {
                id: latestInvoice.id,
                invoiceNo: latestInvoice.invoiceNo,
                amount: latestInvoice.amount,
                paidAmount: latestInvoice.paidAmount,
                unpaidAmount: latestInvoice.unpaidAmount,
                status: latestInvoice.status,
                createdAt: latestInvoice.createdAt,
                paidAt: latestInvoice.paidAt,
                manualPayments: latestInvoice.manualPayments?.map((payment) => ({
                  id: payment.id,
                  amount: payment.amount,
                  paymentMethod: payment.paymentMethod,
                  collectedAt: payment.collectedAt,
                  note: payment.note,
                  collectedBy: payment.collectedBy
                    ? {
                        id: payment.collectedBy.id,
                        name: payment.collectedBy.name,
                        email: payment.collectedBy.email,
                      }
                    : null,
                })) ?? [],
              }
            : null,

          registrationPhotos: session.registrationPhotos?.map((photo) => ({
            id: photo.id,
            imageUrl: photo.imageUrl,
            photoType: photo.photoType,
            required: photo.required,
            capturedByUserId: photo.capturedByUserId,
            capturedByRole: photo.capturedByRole,
            createdAt: photo.createdAt,
          })) ?? [],

          isRegistered: session.isRegistered,
          registeredAt: session.registeredAt,
          metadata: session.metadata,

          parkingLotName:
            session.ParkingSpace?.section?.parkingLot?.name ??
            session.ParkingSpace?.section?.parkingLot?.code ??
            null,
          sectionName:
            session.ParkingSpace?.section?.name ??
            session.ParkingSpace?.section?.code ??
            null,
          parkingSpaceCode:
            session.ParkingSpace?.code ??
            null,

          parkingSpace: {
            id: session.ParkingSpace?.id ?? null,
            code: session.ParkingSpace?.code ?? null,
            name: null,
            status: session.ParkingSpace?.status ?? null,
            section: {
              id: session.ParkingSpace?.section?.id ?? null,
              name: session.ParkingSpace?.section?.name ?? null,
              code: session.ParkingSpace?.section?.code ?? null,
              parkingLot: {
                id: session.ParkingSpace?.section?.parkingLot?.id ?? null,
                name: session.ParkingSpace?.section?.parkingLot?.name ?? null,
                code: session.ParkingSpace?.section?.parkingLot?.code ?? null,
              },
            },
          },

          ParkingSpace: {
            id: session.ParkingSpace?.id ?? null,
            code: session.ParkingSpace?.code ?? null,
            status: session.ParkingSpace?.status ?? null,
            section: session.ParkingSpace?.section?.name ?? null,
            parkingLot:
              session.ParkingSpace?.section?.parkingLot?.name ?? null,

            device: sensorDevice
              ? {
                  id: sensorDevice.id,
                  name: sensorDevice.name,
                  type: sensorDevice.type,
                  devEui: sensorDevice.devEui ?? null,
                }
              : null,
          },

          feePolicy: session.feePolicy
            ? {
                id: session.feePolicy.id,
                name: session.feePolicy.name,
              }
            : null,

          latestSensorData,
        };
      }),
    );

    return {
      ok: true,
      items: result,
    };
  }

  async addRegistrationPhoto(
    userId: string,
    sessionId: string,
    input: {
      imageUrl?: string;
      photoType?: string;
      required?: boolean;
    },
  ) {
    const session = await this.prisma.parkingSession.findUnique({
      where: { id: sessionId },
    });

    if (!session) {
      throw new NotFoundException('Parking session not found');
    }

    const imageUrl = input.imageUrl?.trim();

    if (!imageUrl) {
      throw new BadRequestException('imageUrl is required');
    }

    const photoType = String(input.photoType ?? 'VEHICLE_PLATE').toUpperCase();

    if (!['VEHICLE_PLATE', 'PARKING_SPACE', 'DISPUTE_EVIDENCE'].includes(photoType)) {
      throw new BadRequestException('Invalid photoType');
    }

    const photo = await this.prisma.parkingRegistrationPhoto.create({
      data: {
        parkingSessionId: session.id,
        imageUrl,
        photoType: photoType as any,
        required: Boolean(input.required),
        capturedByUserId: userId,
        capturedByRole: 'OPERATOR',
      },
    });

    await this.prisma.parkingSessionEvent.create({
      data: {
        sessionId: session.id,
        type: 'parking.session.registration_photo_added',
        source: 'operator',
        payload: {
          photoId: photo.id,
          imageUrl,
          photoType,
          capturedByUserId: userId,
        } as any,
      },
    });

    return {
      ok: true,
      photo,
    };
  }

  async recordManualPayment(
    userId: string,
    sessionId: string,
    input: {
      amount?: number;
      paymentMethod?: string;
      collectedAt?: string;
      note?: string;
    },
  ) {
    const session = await this.prisma.parkingSession.findUnique({
      where: { id: sessionId },
      include: {
        invoice: true,
      },
    });

    if (!session) {
      throw new NotFoundException('Parking session not found');
    }

    const invoice = session.invoice;

    if (!invoice) {
      throw new BadRequestException('Invoice is required before manual payment registration');
    }

    if (invoice.unpaidAmount <= 0) {
      throw new BadRequestException('Invoice is already fully paid');
    }

    const amount = Number(input.amount ?? 0);

    if (!Number.isFinite(amount) || amount <= 0) {
      throw new BadRequestException('Payment amount must be greater than 0');
    }

    if (amount > invoice.unpaidAmount) {
      throw new BadRequestException('Payment amount cannot exceed unpaid amount');
    }

    const paymentMethod = String(input.paymentMethod ?? 'CARD').toUpperCase();

    if (!['CARD', 'CASH', 'TRANSFER'].includes(paymentMethod)) {
      throw new BadRequestException('paymentMethod must be CARD, CASH, or TRANSFER');
    }

    const collectedAt = input.collectedAt
      ? new Date(input.collectedAt)
      : new Date();

    if (Number.isNaN(collectedAt.getTime())) {
      throw new BadRequestException('Invalid collectedAt');
    }

    const note = input.note?.trim() || null;
    const nextPaidAmount = invoice.paidAmount + amount;
    const nextUnpaidAmount = Math.max(0, invoice.unpaidAmount - amount);
    const nextInvoiceStatus =
      nextUnpaidAmount <= 0 ? 'PAID' : 'PARTIALLY_PAID';

    const result = await this.prisma.$transaction(async (tx) => {
      const manualPayment = await tx.invoiceManualPayment.create({
        data: {
          invoiceId: invoice.id,
          amount,
          paymentMethod,
          collectedByUserId: userId,
          collectedAt,
          note,
        },
      });

      const updatedInvoice = await tx.invoice.update({
        where: { id: invoice.id },
        data: {
          paidAmount: nextPaidAmount,
          unpaidAmount: nextUnpaidAmount,
          status: nextInvoiceStatus as any,
          paidAt: nextUnpaidAmount <= 0 ? collectedAt : invoice.paidAt,
          metadata: {
            ...((invoice.metadata as any) ?? {}),
            manualPayment: {
              lastManualPaymentId: manualPayment.id,
              amount,
              paymentMethod,
              collectedByUserId: userId,
              collectedAt: collectedAt.toISOString(),
              note,
            },
          } as any,
        },
      });

      const updatedSession = await tx.parkingSession.update({
        where: { id: session.id },
        data: {
          status: nextUnpaidAmount <= 0 ? ('PAID' as any) : (session.status as any),
          paidAmount: Number(session.paidAmount ?? 0) + amount,
          unpaidAmount: nextUnpaidAmount,
          metadata: {
            ...((session.metadata as any) ?? {}),
            paymentStatus: nextUnpaidAmount <= 0 ? 'PAID' : 'PARTIALLY_PAID',
            paymentRequired: nextUnpaidAmount > 0,
            invoiceId: updatedInvoice.id,
            invoiceNo: updatedInvoice.invoiceNo,
            invoiceStatus: updatedInvoice.status,
            invoicePaidAmount: updatedInvoice.paidAmount,
            invoiceUnpaidAmount: updatedInvoice.unpaidAmount,
            manualPayment: {
              lastManualPaymentId: manualPayment.id,
              amount,
              paymentMethod,
              collectedByUserId: userId,
              collectedAt: collectedAt.toISOString(),
              note,
            },
          } as any,
        },
      });

      await tx.parkingSessionEvent.create({
        data: {
          sessionId: session.id,
          type: 'parking.session.manual_payment_registered',
          source: 'operator',
          payload: {
            invoiceId: updatedInvoice.id,
            invoiceNo: updatedInvoice.invoiceNo,
            manualPaymentId: manualPayment.id,
            amount,
            paymentMethod,
            collectedByUserId: userId,
            collectedAt: collectedAt.toISOString(),
            note,
            invoiceStatus: updatedInvoice.status,
            invoicePaidAmount: updatedInvoice.paidAmount,
            invoiceUnpaidAmount: updatedInvoice.unpaidAmount,
          } as any,
        },
      });

      return {
        manualPayment,
        invoice: updatedInvoice,
        session: updatedSession,
      };
    });

    return {
      ok: true,
      manualPayment: result.manualPayment,
      invoice: result.invoice,
      session: result.session,
    };
  }

  async registerSession(userId: string, sessionId: string, input: RegisterSessionInput) {
    const session = await this.prisma.parkingSession.findUnique({
      where: { id: sessionId },
    });

    if (!session) {
      throw new NotFoundException('Parking session not found');
    }

    const plateNumber = input.plateNumber?.trim() || null;
    const contactNumber = input.contactNumber?.trim() || null;

    const previousMetadata = (session.metadata ?? {}) as any;

    const hasRegistration = Boolean(plateNumber || contactNumber);

    const updated = await this.prisma.parkingSession.update({
      where: { id: sessionId },
      data: {
        plateNumber,
        contactPhone: contactNumber,
        isRegistered: hasRegistration,
        registeredAt: hasRegistration ? new Date() : null,
        registrationStatus: hasRegistration
          ? ('REGISTERED_BY_OPERATOR' as any)
          : ('UNREGISTERED' as any),
        registrationMethod: hasRegistration
          ? ('OPERATOR_MANUAL' as any)
          : null,
        registeredByUserId: hasRegistration ? userId : null,
        metadata: {
          ...previousMetadata,
          registrationStatus: hasRegistration
            ? 'REGISTERED_BY_OPERATOR'
            : 'UNREGISTERED',
          registrationMethod: hasRegistration ? 'OPERATOR_MANUAL' : null,
          contactNumber,
          contactPhone: contactNumber,
          registeredBy: 'operator',
          registeredByUserId: hasRegistration ? userId : null,
        } as any,
      },
    });

    await this.prisma.parkingSessionEvent.create({
      data: {
        sessionId,
        type: 'parking.session.manual_registered',
        source: 'operator',
        payload: {
          plateNumber,
          contactNumber,
          registeredByUserId: userId,
        } as any,
      },
    });

    return {
      ok: true,
      item: updated,
    };
  }
}
