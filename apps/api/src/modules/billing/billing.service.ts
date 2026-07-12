import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@parking/db';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class BillingService {
  constructor(private readonly prisma: PrismaService) {}

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
    const dailyMax =
      feePolicy?.dailyMax == null ? null : Number(feePolicy.dailyMax);

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

  private calculateDirectRegistrationDiscount(session: any, feePolicy: any) {
    const method = String(session?.registrationMethod ?? '');

    if (!this.isSelfRegistrationMethod(method)) {
      return 0;
    }

    if (!feePolicy?.registrationGraceDiscountEnabled) {
      return 0;
    }

    if (!session?.registeredAt) {
      return 0;
    }

    const registeredMinutes = this.diffMinutes(
      session.entryTime,
      session.registeredAt,
    );

    const registrationGraceMinutes = Number(
      feePolicy?.registrationGraceMinutes ?? 0,
    );

    if (registeredMinutes > registrationGraceMinutes) {
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

  async finalizeInvoiceForSessionId(
    sessionId: string,
    options?: { exitTime?: Date },
  ) {
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
      invoice: true,
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

    const directRegistrationDiscountAmount =
      this.calculateDirectRegistrationDiscount(session, feePolicy);

    const watcherRewardBasisAmount =
      this.calculateWatcherRewardBasis(session, feePolicy);

    const finalAmount = Math.max(
      0,
      baseParkingAmount - directRegistrationDiscountAmount,
    );

    const paidAmount = session.invoice?.paidAmount ?? 0;
    const unpaidAmount = Math.max(0, finalAmount - paidAmount);

    const invoiceNo =
      session.invoice?.invoiceNo ??
      `INV-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${session.sessionNo}`;

    const pricingSnapshot = {
      totalMinutes,
      baseParkingAmount,
      directRegistrationDiscountAmount,
      registrationGraceDiscountAmount: directRegistrationDiscountAmount,
      watcherRewardBasisAmount,
      finalAmount,
      paidAmount,
      unpaidAmount,
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

    const invoice = await this.prisma.invoice.upsert({
      where: {
        sessionId: session.id,
      },
      create: {
        invoiceNo,
        sessionId: session.id,
        status: unpaidAmount > 0 ? 'ISSUED' : 'PAID',
        amount: finalAmount,
        discountAmount: directRegistrationDiscountAmount,
        paidAmount,
        unpaidAmount,
        baseParkingAmount,
        registrationGraceDiscountAmount: directRegistrationDiscountAmount,
        authorityRegistrationSurchargeAmount: 0,
        watcherRewardBasisAmount,
        finalAmount,
        issuedAt: new Date(),
        paidAt: unpaidAmount > 0 ? null : new Date(),
        metadata: pricingSnapshot as any,
      },
      update: {
        status: unpaidAmount > 0 ? 'ISSUED' : 'PAID',
        amount: finalAmount,
        discountAmount: directRegistrationDiscountAmount,
        paidAmount,
        unpaidAmount,
        baseParkingAmount,
        registrationGraceDiscountAmount: directRegistrationDiscountAmount,
        authorityRegistrationSurchargeAmount: 0,
        watcherRewardBasisAmount,
        finalAmount,
        issuedAt: session.invoice?.issuedAt ?? new Date(),
        paidAt: unpaidAmount > 0 ? null : session.invoice?.paidAt ?? new Date(),
        metadata: pricingSnapshot as any,
      },
    });

    const updatedSession = await this.prisma.parkingSession.update({
      where: {
        id: session.id,
      },
      data: {
        exitTime,
        totalMinutes,
        amount: finalAmount,
        paidAmount,
        unpaidAmount,
        feePolicyId: feePolicy.id,
        billingClosedAt: new Date(),
      },
      include: {
        invoice: true,
      },
    });

    return {
      session: updatedSession,
      invoice,
      calculation: {
        totalMinutes,
        baseParkingAmount,
        directRegistrationDiscountAmount,
        registrationGraceDiscountAmount: directRegistrationDiscountAmount,
        watcherRewardBasisAmount,
        finalAmount,
        paidAmount,
        unpaidAmount,
      },
    };
  }
  async listBillingRecords() {
    return this.prisma.invoice.findMany({
      orderBy: {
        createdAt: 'desc',
      },
      take: 100,
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
            vehicle: true,
            user: true,
          },
        },
        payments: true,
        receipts: true,
        manualPayments: true,
      },
    });
  }

  async getSummary() {
    const [totalCount, paidCount, issuedCount, overdueCount, invoices] =
      await Promise.all([
        this.prisma.invoice.count(),
        this.prisma.invoice.count({ where: { status: 'PAID' as any } }),
        this.prisma.invoice.count({ where: { status: 'ISSUED' as any } }),
        this.prisma.invoice.count({ where: { status: 'OVERDUE' as any } }),
        this.prisma.invoice.findMany({
          select: {
            amount: true,
            paidAmount: true,
            unpaidAmount: true,
          },
        }),
      ]);

    const totalAmount = invoices.reduce((sum, item) => sum + item.amount, 0);
    const paidAmount = invoices.reduce((sum, item) => sum + item.paidAmount, 0);
    const unpaidAmount = invoices.reduce(
      (sum, item) => sum + item.unpaidAmount,
      0,
    );

    return {
      totalCount,
      paidCount,
      issuedCount,
      overdueCount,
      totalAmount,
      paidAmount,
      unpaidAmount,
    };
  }

  async getOutstandingInvoices() {
    return this.prisma.invoice.findMany({
      where: {
        unpaidAmount: {
          gt: 0,
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
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
            vehicle: true,
            user: true,
          },
        },
        payments: true,
        receipts: true,
        manualPayments: true,
      },
    });
  }

  async getInvoiceBySession(sessionId: string) {
    return this.prisma.invoice.findUnique({
      where: {
        sessionId,
      },
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
            vehicle: true,
            user: true,
          },
        },
        payments: true,
        receipts: true,
        manualPayments: true,
      },
    });
  }

  async createInvoice(sessionId: string) {
    const result = await this.finalizeInvoiceForSessionId(sessionId);
    return result.invoice;
  }

  async payInvoice(id: string) {
    const invoice = await this.prisma.invoice.findUnique({
      where: {
        id,
      },
    });

    if (!invoice) {
      throw new NotFoundException('Invoice not found');
    }

    const paidAt = new Date();

    return this.prisma.invoice.update({
      where: {
        id,
      },
      data: {
        status: 'PAID' as any,
        paidAmount: invoice.amount,
        unpaidAmount: 0,
        paidAt,
        metadata: {
          ...((invoice.metadata as any) ?? {}),
          paidBy: 'billing.payInvoice',
          paidAt,
        } as any,
      },
      include: {
        payments: true,
        receipts: true,
        session: true,
      },
    });
  }

  async forceCloseInvoice(id: string) {
    const invoice = await this.prisma.invoice.findUnique({
      where: {
        id,
      },
    });

    if (!invoice) {
      throw new NotFoundException('Invoice not found');
    }

    return this.prisma.invoice.update({
      where: {
        id,
      },
      data: {
        status: invoice.unpaidAmount > 0 ? ('ISSUED' as any) : ('PAID' as any),
        metadata: {
          ...((invoice.metadata as any) ?? {}),
          forceClosedAt: new Date(),
        } as any,
      },
      include: {
        payments: true,
        receipts: true,
        session: true,
      },
    });
  }

  async issueReceipt(id: string) {
    const invoice = await this.prisma.invoice.findUnique({
      where: {
        id,
      },
      include: {
        session: true,
        payments: {
          orderBy: {
            createdAt: 'desc',
          },
          take: 1,
        },
      },
    });

    if (!invoice) {
      throw new NotFoundException('Invoice not found');
    }

    const payment = invoice.payments[0];

    if (!payment) {
      throw new BadRequestException('Payment not found for invoice');
    }

    return this.prisma.receipt.upsert({
      where: {
        paymentId: payment.id,
      },
      create: {
        receiptNo: `R-${Date.now()}-${payment.id.slice(-6)}`,
        paymentId: payment.id,
        invoiceId: invoice.id,
        sessionId: invoice.sessionId,
        ownerUserId: invoice.session?.userId ?? null,
        ownerPhone: invoice.session?.contactPhone ?? null,
        supplyAmount: invoice.amount,
        taxAmount: 0,
        totalAmount: invoice.amount,
        status: 'ISSUED' as any,
        metadata: {
          issuedBy: 'billing.issueReceipt',
        } as any,
      },
      update: {
        status: 'ISSUED' as any,
        metadata: {
          issuedBy: 'billing.issueReceipt',
          reissuedAt: new Date(),
        } as any,
      },
    });
  }

  async listFeePolicies(query?: {
    region?: string;
    sido?: string;
    district?: string;
    sigungu?: string;
    parkingLotId?: string;
    isActive?: string | boolean;
  }) {
    const sido = String(query?.sido ?? query?.region ?? '').trim();
    const sigungu = String(query?.sigungu ?? query?.district ?? '').trim();
    const parkingLotId = String(query?.parkingLotId ?? '').trim();

    const isActive =
      query?.isActive === undefined || query?.isActive === ''
        ? undefined
        : query?.isActive === true || query?.isActive === 'true';

    return this.prisma.feePolicy.findMany({
      where: {
        ...(isActive === undefined ? {} : { isActive }),
        ...(parkingLotId ? { parkingLotId } : {}),
        parkingLot: {
          ...(sido ? { sido } : {}),
          ...(sigungu ? { sigungu } : {}),
        },
      },
      orderBy: [
        { isActive: 'desc' },
        { parkingLotId: 'asc' },
        { createdAt: 'desc' },
      ],
      include: {
        parkingLot: true,
        timeRules: true,
      },
    });
  }

  async getFeePolicy(id: string) {
    return this.prisma.feePolicy.findUnique({
      where: {
        id,
      },
      include: {
        parkingLot: true,
        timeRules: true,
      },
    });
  }

}
