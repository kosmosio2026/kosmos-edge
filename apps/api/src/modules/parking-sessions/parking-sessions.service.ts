import {
  enqueueEdgeParkingSessionSync,
  enqueueEdgeUnpaidExitSync,
} from '../../common/sync/edge-parking-session-sync';

import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { SessionStatus, SpaceStatus } from '@parking/db';
import { PrismaService } from '../../prisma/prisma.service';
import type { AuthUser } from '../../common/types/auth-user.type';
import { ParkingFeeCalculatorService } from '../billing/parking-fee-calculator.service';
import { BillingService } from '../billing/billing.service';

type GetSessionsParams = {
  user?: AuthUser;
  parkingLotId?: string;
  status?: string;
};

type RegisterSessionInput = {
  plateNumber?: string | null;
  contactNumber?: string | null;
};

type ManualEntryInput = {
  parkingSpaceId?: string | null;
  plateNumber?: string | null;
  contactNumber?: string | null;
};

type ManualExitInput = {
  collectedAmount?: number | string | null;
  paymentMethod?: string | null;
  note?: string | null;
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

function normalizeManualPaymentMethod(value?: string | null) {
  const method = String(value ?? 'CARD').trim().toUpperCase();

  if (method === 'BANK_TRANSFER') return 'TRANSFER';
  if (['CARD', 'CASH', 'TRANSFER'].includes(method)) return method;

  return 'CARD';
}

@Injectable()
export class ParkingSessionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly feeCalculator: ParkingFeeCalculatorService,
    private readonly billingService: BillingService,
  ) {}

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
  private assertManualOperationRole(user: AuthUser) {
    if (isAdmin(user) || isManager(user) || isOperator(user)) {
      return;
    }

    throw new ForbiddenException('수동 입차/출차 권한이 없습니다.');
  }

  private async assertManualSpaceAccess(user: AuthUser, input: {
    parkingLotId: string;
    sectionId: string;
  }) {
    if (isAdmin(user)) return;

    if (isManager(user)) {
      const count = await this.prisma.managerParkingLot.count({
        where: {
          managerProfileUserId: user.sub,
          parkingLotId: input.parkingLotId,
        },
      });

      if (count > 0) return;
    }

    if (isOperator(user)) {
      const count = await this.prisma.operatorParkingSection.count({
        where: {
          operatorProfileUserId: user.sub,
          sectionId: input.sectionId,
        },
      });

      if (count > 0) return;
    }

    throw new ForbiddenException('해당 주차면에 대한 수동 입차/출차 권한이 없습니다.');
  }

  private createManualSessionNo() {
    return `MANUAL-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
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
        const feeSummary = await this.feeCalculator.summarize(session);
        const accruedFeeAmount =
          session.status === SessionStatus.ACTIVE ? feeSummary.expectedFee : null;
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
          invoiceId: latestInvoice?.id ?? null,
          invoiceNo: latestInvoice?.invoiceNo ?? null,
          invoiceStatus: latestInvoice?.status ?? null,
          receiptId: latestInvoice?.status === 'PAID' ? latestInvoice.id : null,
          paidAt: latestInvoice?.paidAt ?? null,

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
          feePolicyId: feeSummary.feePolicyId,
          feePolicyName: feeSummary.feePolicyName,
          feePolicySource: feeSummary.feePolicySource,
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

  async recordActionLog(
    userId: string,
    sessionId: string,
    dto: {
      type?: string;
      note?: string;
      action?: string;
      reason?: string;
      elapsedMinutes?: number;
      paidExitMinutes?: number;
    },
  ) {
    const session = await this.prisma.parkingSession.findUnique({
      where: { id: sessionId },
      include: {
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
      },
    });

    if (!session) {
      throw new NotFoundException('Parking session not found');
    }

    const type = String(dto.type ?? 'PAID_EXIT_CHECK').trim() || 'PAID_EXIT_CHECK';
    const now = new Date();

    const event = await this.prisma.parkingSessionEvent.create({
      data: {
        sessionId: session.id,
        type,
        source: 'console',
        payload: {
          action: dto.action ?? 'FIELD_CHECK',
          reason: dto.reason ?? 'PAID_WITHOUT_EXIT',
          note: dto.note ?? null,
          userId,
          elapsedMinutes: dto.elapsedMinutes ?? null,
          paidExitMinutes: dto.paidExitMinutes ?? null,
          sessionStatus: session.status,
          invoiceId: session.invoice?.id ?? null,
          invoiceNo: session.invoice?.invoiceNo ?? null,
          invoiceStatus: session.invoice?.status ?? null,
          paidAt: session.invoice?.paidAt ?? null,
          parkingLotName: session.ParkingSpace?.section?.parkingLot?.name ?? null,
          sectionCode: session.ParkingSpace?.section?.code ?? null,
          parkingSpaceCode: session.ParkingSpace?.code ?? session.ParkingSpace?.number ?? null,
          recordedAt: now.toISOString(),
        },
      },
    });

    return {
      ok: true,
      event,
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
        invoices: {
          orderBy: {
            createdAt: 'desc',
          },
          take: 1,
        },
      },
    });

    if (!session) {
      throw new NotFoundException('Parking session not found');
    }

    const invoice = session.invoice ?? session.invoices?.[0] ?? null;

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

    const paymentMethod = normalizeManualPaymentMethod(input.paymentMethod);

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

    const nextSessionStatus =
      session.exitTime || session.status === SessionStatus.CLOSED
        ? SessionStatus.CLOSED
        : nextUnpaidAmount <= 0
          ? SessionStatus.PAID
          : session.status;

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
            paidAmount: nextPaidAmount,
            unpaidAmount: nextUnpaidAmount,
            invoiceStatus: nextInvoiceStatus,
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
          status: nextSessionStatus as any,
          primaryInvoiceId: updatedInvoice.id,
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

  private async resolveMemberVehicleForSession(plateNumber?: string | null) {
    const normalizedPlate = plateNumber?.trim();
    if (!normalizedPlate) {
      return { userId: null, vehicleId: null };
    }

    const vehicle = await this.prisma.vehicle.findUnique({
      where: { plateNumber: normalizedPlate },
      include: {
        memberProfile: {
          select: { userId: true },
        },
        userLinks: {
          orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }],
          include: {
            user: {
              select: {
                id: true,
                memberProfile: { select: { id: true } },
              },
            },
          },
        },
      },
    });

    if (!vehicle) {
      return { userId: null, vehicleId: null };
    }

    const linkedMemberUserId =
      vehicle.memberProfile?.userId ??
      vehicle.userLinks.find((link) => Boolean(link.user.memberProfile))?.userId ??
      null;

    return {
      userId: linkedMemberUserId,
      vehicleId: linkedMemberUserId ? vehicle.id : null,
    };
  }

  async manualEntry(user: AuthUser, input: ManualEntryInput) {
    this.assertManualOperationRole(user);

    const parkingSpaceId = input.parkingSpaceId?.trim();
    if (!parkingSpaceId) {
      throw new BadRequestException('주차면 ID는 필수입니다.');
    }

    const space = await this.prisma.parkingSpace.findUnique({
      where: { id: parkingSpaceId },
      include: {
        section: {
          include: {
            parkingLot: true,
          },
        },
      },
    });

    if (!space) {
      throw new NotFoundException('Parking space not found');
    }

    const parkingLot = space.section?.parkingLot;
    if (!parkingLot) {
      throw new BadRequestException('주차면의 주차장 정보를 확인하지 못했습니다.');
    }

    if ((parkingLot as any).operationMode !== 'MANUAL') {
      throw new BadRequestException('수동 운영 방식 주차장에서만 입차 등록할 수 있습니다.');
    }

    await this.assertManualSpaceAccess(user, {
      parkingLotId: parkingLot.id,
      sectionId: space.sectionId,
    });

    const activeSession = await this.prisma.parkingSession.findFirst({
      where: {
        parkingSpaceId,
        status: {
          in: [SessionStatus.ACTIVE, SessionStatus.PAID],
        },
        exitTime: null,
      },
      select: {
        id: true,
        sessionNo: true,
      },
    });

    if (activeSession) {
      throw new BadRequestException('이미 진행 중인 주차 세션이 있는 주차면입니다.');
    }

    const now = new Date();
    const plateNumber = input.plateNumber?.trim() || null;
    const contactNumber = input.contactNumber?.trim() || null;
    const hasRegistration = Boolean(plateNumber || contactNumber);
    const memberVehicle = await this.resolveMemberVehicleForSession(plateNumber);

    if (!hasRegistration) {
      throw new BadRequestException('차량번호 또는 연락처를 입력하세요.');
    }

    const session = await this.prisma.$transaction(async (tx) => {
      const created = await tx.parkingSession.create({
        data: {
          sessionNo: this.createManualSessionNo(),
          parkingSpaceId,
          status: SessionStatus.ACTIVE,
          entryTime: now,
          entrySource: 'MANUAL',
          manualEntryAt: now,
          manualEntryByUserId: user.sub,
          plateNumber,
          contactPhone: contactNumber,
          userId: memberVehicle.userId,
          vehicleId: memberVehicle.vehicleId,
          isRegistered: hasRegistration,
          registeredAt: hasRegistration ? now : null,
          registrationStatus: hasRegistration
            ? ('REGISTERED_BY_OPERATOR' as any)
            : ('UNREGISTERED' as any),
          registrationMethod: hasRegistration
            ? ('OPERATOR_MANUAL' as any)
            : null,
          registeredByUserId: hasRegistration ? user.sub : null,
          metadata: {
            entrySource: 'MANUAL',
            manualEntryAt: now.toISOString(),
            manualEntryByUserId: user.sub,
            operationMode: 'MANUAL',
            parkingLotId: parkingLot.id,
            parkingLotCode: parkingLot.code,
            parkingLotName: parkingLot.name,
            sectionId: space.sectionId,
            parkingSpaceId,
            plateNumber,
            contactNumber,
            linkedMemberUserId: memberVehicle.userId,
            linkedVehicleId: memberVehicle.vehicleId,
          } as any,
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
        },
      });

      await tx.parkingSessionEvent.create({
        data: {
          sessionId: created.id,
          type: 'parking.session.manual_entry_registered',
          source: 'operator',
          payload: {
            parkingSpaceId,
            parkingLotId: parkingLot.id,
            sectionId: space.sectionId,
            registeredByUserId: user.sub,
            plateNumber,
            contactNumber,
            occurredAt: now.toISOString(),
          } as any,
        },
      });

      await tx.parkingSpace.update({
        where: { id: parkingSpaceId },
        data: {
          status: SpaceStatus.OCCUPIED,
        },
      });

      return tx.parkingSession.findUniqueOrThrow({
        where: { id: created.id },
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
      });
    });

    await enqueueEdgeParkingSessionSync(
      this.prisma,
      {
        eventType:
          'PARKING_SESSION_ENTERED_FROM_EDGE',
        session,
        calculation: null,
        source:
          'MANUAL_OPERATION',
      },
    );

    return {
      ok: true,
      item: session,
    };
  }

  async manualExit(user: AuthUser, sessionId: string, input: ManualExitInput) {
    this.assertManualOperationRole(user);

    const session = await this.prisma.parkingSession.findUnique({
      where: { id: sessionId },
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
    });

    if (!session) {
      throw new NotFoundException('Parking session not found');
    }

    if (session.entrySource !== 'MANUAL') {
      throw new BadRequestException('수동 입차 세션만 수동 출차 처리할 수 있습니다.');
    }

    if (session.exitTime) {
      throw new BadRequestException('이미 출차 처리된 세션입니다.');
    }

    if (
      session.status !== SessionStatus.ACTIVE &&
      session.status !== SessionStatus.PAID
    ) {
      throw new BadRequestException(
        '진행 중이거나 결제 완료된 세션만 수동 출차 처리할 수 있습니다.',
      );
    }

    const space = session.ParkingSpace;
    const parkingLot = space?.section?.parkingLot;

    if (!space || !parkingLot) {
      throw new BadRequestException('세션의 주차면 정보를 확인하지 못했습니다.');
    }

    if ((parkingLot as any).operationMode !== 'MANUAL') {
      throw new BadRequestException('수동 운영 방식 주차장에서만 출차 등록할 수 있습니다.');
    }

    await this.assertManualSpaceAccess(user, {
      parkingLotId: parkingLot.id,
      sectionId: space.sectionId,
    });

    const now = new Date();
    const linkedPrimaryInvoice = session.primaryInvoiceId
      ? await this.prisma.invoice.findUnique({
          where: { id: session.primaryInvoiceId },
        })
      : null;

    const existingPrimaryInvoice =
      linkedPrimaryInvoice?.status === 'PAID' &&
      Number(linkedPrimaryInvoice.unpaidAmount ?? 0) <= 0
        ? linkedPrimaryInvoice
        : await this.prisma.invoice.findFirst({
            where: {
              sessionId: session.id,
              status: 'PAID' as any,
              unpaidAmount: 0,
            },
            orderBy: [
              {
                paidAt: 'desc',
              },
              {
                createdAt: 'desc',
              },
            ],
          });
    const sessionMetadata = (session.metadata ?? {}) as any;
    const paidExitGraceUntilRaw = sessionMetadata.paidExitGraceUntil;
    const paidExitGraceUntil =
      typeof paidExitGraceUntilRaw === 'string' && paidExitGraceUntilRaw.trim()
        ? new Date(paidExitGraceUntilRaw)
        : null;
    const hasFullyPaidPrimaryInvoice =
      existingPrimaryInvoice?.status === 'PAID' &&
      Number(existingPrimaryInvoice.unpaidAmount ?? 0) <= 0;

    if (
      hasFullyPaidPrimaryInvoice &&
      paidExitGraceUntil &&
      !Number.isNaN(paidExitGraceUntil.getTime()) &&
      now.getTime() > paidExitGraceUntil.getTime()
    ) {
      throw new BadRequestException(
        '결제 후 출차 유예시간이 만료되었습니다. 기존 결제 청구서는 변경할 수 없으므로 추가요금 정산 후 출차하세요.',
      );
    }

    const preservePaidPrimaryInvoice = Boolean(
      hasFullyPaidPrimaryInvoice && existingPrimaryInvoice,
    );
    const entryTime = session.entryTime ?? session.createdAt;
    const totalMinutes = Math.max(
      1,
      Math.ceil((now.getTime() - entryTime.getTime()) / 1000 / 60),
    );

    const rawAmount =
      input.collectedAmount === null || input.collectedAmount === undefined || input.collectedAmount === ''
        ? null
        : Number(input.collectedAmount);

    if (rawAmount !== null && (!Number.isFinite(rawAmount) || rawAmount < 0)) {
      throw new BadRequestException('수금 금액은 0 이상의 숫자로 입력하세요.');
    }

    const collectedAmount = rawAmount === null ? null : Math.floor(rawAmount);
    const paymentMethod =
      collectedAmount !== null && collectedAmount > 0
        ? normalizeManualPaymentMethod(input.paymentMethod)
        : null;
    const note = input.note?.trim() || null;

    const updated = await this.prisma.$transaction(async (tx) => {
      const closed = await tx.parkingSession.update({
        where: { id: session.id },
        data: {
          status: SessionStatus.CLOSED,
          exitTime: now,
          billingClosedAt: now,
          totalMinutes,
          exitSource: 'MANUAL',
          manualExitAt: now,
          manualExitByUserId: user.sub,
          metadata: {
            ...((session.metadata as any) ?? {}),
            exitSource: 'MANUAL',
            manualExitAt: now.toISOString(),
            manualExitByUserId: user.sub,
            manualExitCollectedAmount: collectedAmount,
            manualExitPaymentMethod: paymentMethod,
            manualExitNote: note,
            totalMinutes,
          } as any,
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
        },
      });

      await tx.parkingSessionEvent.create({
        data: {
          sessionId: closed.id,
          type: 'parking.session.manual_exit_registered',
          source: 'operator',
          payload: {
            parkingSpaceId: closed.parkingSpaceId,
            parkingLotId: parkingLot.id,
            sectionId: space.sectionId,
            exitedByUserId: user.sub,
            exitTime: now.toISOString(),
            totalMinutes,
            collectedAmount,
            paymentMethod,
            note,
          } as any,
        },
      });

      await tx.parkingSpace.update({
        where: { id: space.id },
        data: {
          status: SpaceStatus.EMPTY,
        },
      });

      return tx.parkingSession.findUniqueOrThrow({
        where: { id: closed.id },
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
      });
    });

    let manualPaymentResult: Awaited<ReturnType<ParkingSessionsService['recordManualPayment']>> | null = null;

    if (!preservePaidPrimaryInvoice) {
      await this.billingService.finalizeInvoiceForSessionId(updated.id, {
        exitTime: now,
      });
    }

    const primaryInvoice = preservePaidPrimaryInvoice
      ? existingPrimaryInvoice
      : await this.prisma.invoice.findFirst({
          where: {
            sessionId: updated.id,
          },
          orderBy: {
            createdAt: 'desc',
          },
        });

    if (primaryInvoice) {
      await this.prisma.parkingSession.update({
        where: {
          id: updated.id,
        },
        data: {
          primaryInvoiceId: primaryInvoice.id,
          amount: primaryInvoice.amount,
          paidAmount: primaryInvoice.paidAmount,
          unpaidAmount: primaryInvoice.unpaidAmount,
          metadata: {
            ...((updated.metadata as any) ?? {}),
            invoiceId: primaryInvoice.id,
            invoiceNo: primaryInvoice.invoiceNo,
            invoiceStatus: primaryInvoice.status,
            invoiceAmount: primaryInvoice.amount,
            invoicePaidAmount: primaryInvoice.paidAmount,
            invoiceUnpaidAmount: primaryInvoice.unpaidAmount,
            paymentStatus:
              primaryInvoice.unpaidAmount <= 0
                ? 'PAID'
                : primaryInvoice.paidAmount > 0
                  ? 'PARTIALLY_PAID'
                  : 'UNPAID',
            paymentRequired: primaryInvoice.unpaidAmount > 0,
          } as any,
        },
      });
    }

    if (collectedAmount !== null && collectedAmount > 0) {
      manualPaymentResult = await this.recordManualPayment(user.sub, updated.id, {
        amount: collectedAmount,
        paymentMethod: paymentMethod ?? 'CARD',
        collectedAt: now.toISOString(),
        note: note ?? undefined,
      });
    }

    const refreshed = await this.prisma.parkingSession.findUniqueOrThrow({
      where: { id: updated.id },
      include: {
        invoice: {
          include: {
            manualPayments: true,
          },
        },
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

    const finalInvoice =
      manualPaymentResult?.invoice ??
      refreshed.invoice ??
      null;

    const refreshedMetadata =
      ((refreshed.metadata ?? {}) as any);

    await enqueueEdgeParkingSessionSync(
      this.prisma,
      {
        eventType:
          'PARKING_SESSION_EXITED_FROM_EDGE',
        session:
          refreshed,
        invoice:
          finalInvoice,
        calculation:
          refreshedMetadata.feeCalculation ??
          null,
        source:
          'MANUAL_OPERATION',
      },
    );

    if (
      finalInvoice &&
      Number(finalInvoice.unpaidAmount ?? 0) > 0
    ) {
      await enqueueEdgeUnpaidExitSync(
        this.prisma,
        {
          session:
            refreshed,
          invoice:
            finalInvoice,
          calculation:
            refreshedMetadata.feeCalculation ??
            null,
          additionalFeeAmount:
            Number(
              refreshedMetadata.additionalFeeAmount ??
              finalInvoice.unpaidAmount ??
              0,
            ),
          additionalFeeReason:
            refreshedMetadata.additionalFeeReason ??
            'UNPAID_BEFORE_EXIT',
          source:
            'MANUAL_OPERATION',
        },
      );
    }

    return {
      ok: true,
      item:
        refreshed,
      invoice:
        finalInvoice,
      manualPayment:
        manualPaymentResult?.manualPayment ??
        null,
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
    const memberVehicle = await this.resolveMemberVehicleForSession(plateNumber);

    const updated = await this.prisma.parkingSession.update({
      where: { id: sessionId },
      data: {
        plateNumber,
        contactPhone: contactNumber,
        userId: memberVehicle.userId,
        vehicleId: memberVehicle.vehicleId,
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
          linkedMemberUserId: memberVehicle.userId,
          linkedVehicleId: memberVehicle.vehicleId,
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
          linkedMemberUserId: memberVehicle.userId,
          linkedVehicleId: memberVehicle.vehicleId,
        } as any,
      },
    });

    return {
      ok: true,
      item: updated,
    };
  }
}
