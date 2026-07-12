import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import {
  FeePolicyService,
  ParkingFeeCalculationResult,
} from '../fees/fee-policy.service';

type InvoiceStatusLike =
  | 'DRAFT'
  | 'ISSUED'
  | 'PARTIALLY_PAID'
  | 'PAID'
  | 'OVERDUE'
  | 'VOID'
  | 'CANCELLED';

type InvoiceLike = {
  id: string;
  invoiceNo: string;
  sessionId: string;
  status: InvoiceStatusLike | string;
  amount: number;
  discountAmount: number;
  paidAmount: number;
  unpaidAmount: number;
  issuedAt: Date | null;
  dueAt: Date | null;
  paidAt: Date | null;
  metadata: unknown;
  createdAt: Date;
  updatedAt: Date;
};

type CollectionAction =
  | 'CREATE_PAYMENT_LINK'
  | 'COPY_PAYMENT_LINK'
  | 'SEND_SMS'
  | 'SEND_EMAIL'
  | 'CALL_DRIVER'
  | 'MARK_CONTACTED'
  | 'PUBLIC_PAYMENT_COMPLETED';

@Injectable()
export class InvoicesService {
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

  private calculateDirectRegistrationDiscount(session: any, policy: any) {
    if (!this.isSelfRegistrationMethod(session?.registrationMethod)) {
      return 0;
    }

    if (!policy?.registrationGraceDiscountEnabled) {
      return 0;
    }

    if (!session?.entryTime || !session?.registeredAt) {
      return 0;
    }

    const registeredMinutes = this.diffMinutes(
      new Date(session.entryTime),
      new Date(session.registeredAt),
    );

    const registrationGraceMinutes = Math.max(
      0,
      Number(policy?.registrationGraceMinutes ?? 0),
    );

    if (registeredMinutes > registrationGraceMinutes) {
      return 0;
    }

    return Math.max(0, Number(policy?.registrationGraceFee ?? 0));
  }

  private calculateWatcherRewardBasis(session: any, policy: any) {
    if (!this.isWatcherRegistrationMethod(session?.registrationMethod)) {
      return 0;
    }

    if (!policy?.watcherRewardGraceFeeEnabled) {
      return 0;
    }

    return Math.max(0, Number(policy?.registrationGraceFee ?? 0));
  }


  constructor(
    private readonly prisma: PrismaService,
    private readonly feePolicyService: FeePolicyService,
  ) {}

  async findBySessionId(sessionId: string): Promise<InvoiceLike | null> {
    return this.prisma.invoice.findUnique({
      where: {
        sessionId,
      },
    }) as Promise<InvoiceLike | null>;
  }

  async listUnpaidInvoices(input?: {
    parkingLotId?: string;
    limit?: number;
  }) {
    const limit =
      input?.limit && Number.isFinite(input.limit) && input.limit > 0
        ? Math.min(Math.floor(input.limit), 200)
        : 100;

    const invoices = await this.prisma.invoice.findMany({
      where: {
        unpaidAmount: {
          gt: 0,
        },
        status: {
          in: ['ISSUED', 'PARTIALLY_PAID', 'OVERDUE'] as any,
        },
        session: input?.parkingLotId
          ? {
              ParkingSpace: {
                section: {
                  parkingLotId: input.parkingLotId,
                },
              },
            }
          : undefined,
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
          },
        },
      },
      orderBy: [
        {
          updatedAt: 'desc',
        },
        {
          createdAt: 'desc',
        },
      ],
      take: limit,
    });

    return {
      ok: true,
      generatedAt: new Date().toISOString(),
      items: invoices.map((invoice) => {
        const session = invoice.session as any;
        const invoiceMetadata = this.asObject(invoice.metadata) ?? {};
        const sessionMetadata = this.asObject(session?.metadata) ?? {};
        const parkingSpace = session?.ParkingSpace ?? null;
        const section = parkingSpace?.section ?? null;
        const parkingLot = section?.parkingLot ?? null;

        return {
          invoiceId: invoice.id,
          invoiceNo: invoice.invoiceNo,
          sessionId: invoice.sessionId,
          sessionNo: session?.sessionNo ?? null,
          status: invoice.status,
          amount: invoice.amount,
          discountAmount: invoice.discountAmount,
          paidAmount: invoice.paidAmount,
          unpaidAmount: invoice.unpaidAmount,
          issuedAt: invoice.issuedAt,
          dueAt: invoice.dueAt,
          paidAt: invoice.paidAt,
          createdAt: invoice.createdAt,
          updatedAt: invoice.updatedAt,

          parkingLotId: section?.parkingLotId ?? null,
          parkingLotName: parkingLot?.name ?? null,
          sectionId: section?.id ?? null,
          sectionCode: section?.code ?? null,
          parkingSpaceId: parkingSpace?.id ?? null,
          parkingSpaceCode: parkingSpace?.code ?? null,
          parkingSpaceNumber: parkingSpace?.number ?? null,

          plateNumber:
            session?.plateNumber ??
            sessionMetadata.plateNumber ??
            invoiceMetadata.plateNumber ??
            null,
          driverName:
            session?.driverName ??
            sessionMetadata.driverName ??
            invoiceMetadata.driverName ??
            null,
          phone:
            session?.phone ??
            sessionMetadata.phone ??
            invoiceMetadata.phone ??
            null,

          entryTime: session?.entryTime ?? null,
          exitTime: session?.exitTime ?? null,
          totalMinutes: session?.totalMinutes ?? null,
          sessionStatus: session?.status ?? null,
          paymentRequired: sessionMetadata.paymentRequired === true,
          paymentStatus:
            sessionMetadata.paymentStatus ??
            this.resolveCollectionPaymentStatus({
              unpaidAmount: invoice.unpaidAmount,
              paidAmount: invoice.paidAmount,
              invoiceStatus: String(invoice.status),
            }),
          paymentReason: sessionMetadata.paymentReason ?? null,
          additionalFeeRequired:
            sessionMetadata.additionalFeeRequired === true ||
            typeof sessionMetadata.additionalFeeReason === 'string' ||
            Number(sessionMetadata.additionalFeeAmount ?? 0) > 0 ||
            (invoice.paidAmount > 0 && invoice.unpaidAmount > 0),
          additionalFeeReason:
            typeof sessionMetadata.additionalFeeReason === 'string'
              ? sessionMetadata.additionalFeeReason
              : null,
          additionalFeeAmount:
            Number(sessionMetadata.additionalFeeAmount ?? 0) > 0
              ? Number(sessionMetadata.additionalFeeAmount)
              : invoice.paidAmount > 0 && invoice.unpaidAmount > 0
                ? invoice.unpaidAmount
                : 0,
          exitGraceMinutes:
            sessionMetadata.exitGraceMinutes ?? null,
          exitGraceDeadline:
            typeof sessionMetadata.exitGraceDeadline === 'string'
              ? sessionMetadata.exitGraceDeadline
              : null,

          paymentLinkUrl:
            typeof invoiceMetadata.paymentLinkUrl === 'string'
              ? invoiceMetadata.paymentLinkUrl
              : null,
          collectionStatus:
            typeof invoiceMetadata.collectionStatus === 'string'
              ? invoiceMetadata.collectionStatus
              : 'READY',
          collectionLastAction:
            typeof invoiceMetadata.collectionLastAction === 'string'
              ? invoiceMetadata.collectionLastAction
              : null,
          collectionLastActionAt:
            typeof invoiceMetadata.collectionLastActionAt === 'string'
              ? invoiceMetadata.collectionLastActionAt
              : null,
          collectionHistory: Array.isArray(
            invoiceMetadata.collectionHistory,
          )
            ? invoiceMetadata.collectionHistory
            : [],
        };
      }),
    };
  }

  async createPaymentLink(input: {
    invoiceId: string;
    baseUrl?: string;
    channel?: string;
    recipient?: string;
  }) {
    this.assertCloudPaymentAuthority();

    const now = new Date();

    const invoice = (await this.prisma.invoice.findUnique({
      where: {
        id: input.invoiceId,
      },
    })) as InvoiceLike | null;

    if (!invoice) {
      throw new NotFoundException(`Invoice not found: ${input.invoiceId}`);
    }

    const metadata = this.asObject(invoice.metadata) ?? {};
    const baseUrl = this.normalizeBaseUrl(input.baseUrl);
    const paymentLinkUrl =
      typeof metadata.paymentLinkUrl === 'string'
        ? metadata.paymentLinkUrl
        : `${baseUrl}/pay/invoice/${invoice.id}`;

    const action = this.createCollectionHistoryEntry({
      action: 'CREATE_PAYMENT_LINK',
      channel: input.channel ?? 'WEB',
      recipient: input.recipient,
      note: 'Payment link created',
      createdAt: now,
      metadata: {
        paymentLinkUrl,
      },
    });

    const nextMetadata = this.appendCollectionAction({
      metadata,
      action,
      collectionStatus: 'LINK_CREATED',
      paymentLinkUrl,
    });

    const updatedInvoice = await this.prisma.invoice.update({
      where: {
        id: invoice.id,
      },
      data: {
        metadata: nextMetadata as any,
      },
    });

    return {
      ok: true,
      invoiceId: updatedInvoice.id,
      invoiceNo: updatedInvoice.invoiceNo,
      paymentLinkUrl,
      collectionStatus: 'LINK_CREATED',
      collectionLastAction: 'CREATE_PAYMENT_LINK',
      collectionLastActionAt: now.toISOString(),
    };
  }

  async getPublicInvoice(invoiceId: string) {
    const invoice = await this.prisma.invoice.findUnique({
      where: {
        id: invoiceId,
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
          },
        },
      },
    });

    if (!invoice) {
      throw new NotFoundException(`Invoice not found: ${invoiceId}`);
    }

    const metadata = this.asObject(invoice.metadata) ?? {};
    const session = (invoice as any).session;
    const sessionMetadata = this.asObject(session?.metadata) ?? {};
    const parkingSpace = session?.ParkingSpace ?? null;
    const section = parkingSpace?.section ?? null;
    const parkingLot = section?.parkingLot ?? null;

    return {
      ok: true,
      invoice: {
        invoiceId: invoice.id,
        invoiceNo: invoice.invoiceNo,
        sessionId: invoice.sessionId,
        sessionNo: session?.sessionNo ?? null,
        status: invoice.status,
        amount: invoice.amount,
        discountAmount: invoice.discountAmount,
        paidAmount: invoice.paidAmount,
        unpaidAmount: invoice.unpaidAmount,
        issuedAt: invoice.issuedAt,
        dueAt: invoice.dueAt,
        paidAt: invoice.paidAt,

        parkingLotName: parkingLot?.name ?? null,
        sectionCode: section?.code ?? null,
        parkingSpaceNumber:
          parkingSpace?.number ?? parkingSpace?.code ?? null,

        plateNumber:
          session?.plateNumber ??
          sessionMetadata.plateNumber ??
          metadata.plateNumber ??
          null,
        driverName:
          session?.driverName ??
          sessionMetadata.driverName ??
          metadata.driverName ??
          null,
        phone:
          session?.phone ??
          sessionMetadata.phone ??
          metadata.phone ??
          null,

        entryTime: session?.entryTime ?? null,
        exitTime: session?.exitTime ?? null,
        totalMinutes: session?.totalMinutes ?? null,

        paymentStatus: this.resolveCollectionPaymentStatus({
          unpaidAmount: invoice.unpaidAmount,
          paidAmount: invoice.paidAmount,
          invoiceStatus: String(invoice.status),
        }),
        paymentLinkUrl:
          typeof metadata.paymentLinkUrl === 'string'
            ? metadata.paymentLinkUrl
            : null,
        receipt: this.asObject(metadata.receipt),
      },
    };
  }

  async mockPayInvoice(input: {
    invoiceId: string;
    amount?: number;
    method?: string;
    reference?: string;
  }) {
    this.assertCloudPaymentAuthority();

    const now = new Date();

    const invoice = (await this.prisma.invoice.findUnique({
      where: {
        id: input.invoiceId,
      },
    })) as InvoiceLike | null;

    if (!invoice) {
      throw new NotFoundException(`Invoice not found: ${input.invoiceId}`);
    }

    const invoiceMetadata = this.asObject(invoice.metadata) ?? {};

    if (invoice.unpaidAmount <= 0) {
      return {
        ok: true,
        action: 'ALREADY_PAID',
        invoiceId: invoice.id,
        invoiceNo: invoice.invoiceNo,
        unpaidAmount: invoice.unpaidAmount,
        receipt: this.asObject(invoiceMetadata.receipt),
      };
    }

    const amount =
      input.amount && Number.isFinite(input.amount) && input.amount > 0
        ? Math.min(Math.floor(input.amount), invoice.unpaidAmount)
        : invoice.unpaidAmount;

    const paymentMethod = input.method ?? 'MOCK_CARD';

    const transaction = await this.createPaymentTransaction({
      invoiceId: invoice.id,
      parkingSessionId: invoice.sessionId,
      provider: 'MOCK_PUBLIC_PAYMENT',
      method: paymentMethod,
      status: 'APPROVED',
      amount,
      currency: 'KRW',
      providerReference:
        input.reference ?? `PUBLIC-MOCK-${Date.now()}`,
      approvedAt: now,
      metadata: {
        source: 'PUBLIC_PAYMENT_LINK',
        invoiceId: invoice.id,
        invoiceNo: invoice.invoiceNo,
      },
    });

    const receipt =
      invoice.unpaidAmount - amount <= 0
        ? {
            receiptNo: this.createReceiptNo(now),
            invoiceId: invoice.id,
            invoiceNo: invoice.invoiceNo,
            transactionId: transaction?.id ?? null,
            transactionNo: transaction?.transactionNo ?? null,
            provider: 'MOCK_PUBLIC_PAYMENT',
            method: paymentMethod,
            paidAmount: amount,
            currency: 'KRW',
            paidAt: now.toISOString(),
            source: 'PUBLIC_PAYMENT_LINK',
          }
        : null;

    const collectionAction = this.createCollectionHistoryEntry({
      action: 'PUBLIC_PAYMENT_COMPLETED',
      channel: 'PUBLIC_WEB',
      recipient: null,
      note:
        invoice.unpaidAmount - amount <= 0
          ? 'Public payment completed'
          : 'Public partial payment completed',
      createdAt: now,
      metadata: {
        amount,
        method: paymentMethod,
        transactionId: transaction?.id ?? null,
        transactionNo: transaction?.transactionNo ?? null,
        receipt,
      },
    });

    const updatedInvoice = await this.applyPayment({
      invoiceId: invoice.id,
      amount,
      paidAt: now,
      metadata: this.appendCollectionAction({
        metadata: {
          ...invoiceMetadata,
          paidViaPaymentLink: true,
          paidViaPaymentLinkAt: now.toISOString(),
          publicPayment: {
            transactionId: transaction?.id ?? null,
            transactionNo: transaction?.transactionNo ?? null,
            amount,
            paidAt: now.toISOString(),
            source: 'PUBLIC_PAYMENT_LINK',
          },
          receipt: receipt ?? invoiceMetadata.receipt ?? null,
        },
        action: collectionAction,
        collectionStatus:
          invoice.unpaidAmount - amount <= 0
            ? 'PAID'
            : 'PARTIALLY_PAID',
        paymentLinkUrl:
          typeof invoiceMetadata.paymentLinkUrl === 'string'
            ? invoiceMetadata.paymentLinkUrl
            : undefined,
      }),
    });

    const paymentStatus =
      updatedInvoice.unpaidAmount <= 0 ? 'PAID' : 'PARTIALLY_PAID';

    const session = await this.prisma.parkingSession.findUnique({
      where: {
        id: invoice.sessionId,
      },
    });

    let cloudToEdgeOutboxId: string | null = null;

    if (session) {
      const sessionMetadata = this.asObject(session.metadata) ?? {};

      await this.prisma.parkingSession.update({
        where: {
          id: session.id,
        },
        data: {
          status:
            updatedInvoice.unpaidAmount <= 0
              ? ('PAID' as any)
              : (session.status as any),
          paidAmount: updatedInvoice.paidAmount,
          unpaidAmount: updatedInvoice.unpaidAmount,
          metadata: {
            ...sessionMetadata,
            paymentStatus,
            paymentRequired: updatedInvoice.unpaidAmount > 0,
            exitedUnpaid: updatedInvoice.unpaidAmount > 0,
            additionalFeeRequired: updatedInvoice.unpaidAmount > 0,
            invoiceStatus: updatedInvoice.status,
            invoicePaidAmount: updatedInvoice.paidAmount,
            invoiceUnpaidAmount: updatedInvoice.unpaidAmount,
            collectionStatus:
              updatedInvoice.unpaidAmount <= 0
                ? 'PAID'
                : 'PARTIALLY_PAID',
            paidViaPaymentLink: true,
            paidViaPaymentLinkAt: now.toISOString(),
            receipt: receipt ?? sessionMetadata.receipt ?? null,
            lastPublicPaymentAt: now.toISOString(),
          } as any,
          events: {
            create: {
              type:
                updatedInvoice.unpaidAmount <= 0
                  ? 'PUBLIC_INVOICE_PAID'
                  : 'PUBLIC_INVOICE_PARTIALLY_PAID',
              source: 'PUBLIC_PAYMENT_LINK',
              payload: {
                invoiceId: updatedInvoice.id,
                invoiceNo: updatedInvoice.invoiceNo,
                amount,
                paidAmount: updatedInvoice.paidAmount,
                unpaidAmount: updatedInvoice.unpaidAmount,
                transactionId: transaction?.id ?? null,
                transactionNo: transaction?.transactionNo ?? null,
                receipt,
                paidAt: now.toISOString(),
              } as any,
            },
          },
        },
      });

      const edgeNodeId =
        typeof sessionMetadata.edgeNodeId === 'string'
          ? sessionMetadata.edgeNodeId
          : null;

      if (edgeNodeId) {
        const outbox = await this.createCloudToEdgeOutboxMessage({
          edgeNodeId,
          eventType:
            updatedInvoice.unpaidAmount <= 0
              ? 'INVOICE_PAID_FROM_CLOUD'
              : 'INVOICE_PARTIALLY_PAID_FROM_CLOUD',
          aggregateType: 'Invoice',
          aggregateId: updatedInvoice.id,
          payload: {
            edgeNodeId,
            edgeSessionId:
              typeof sessionMetadata.edgeSessionId === 'string'
                ? sessionMetadata.edgeSessionId
                : session.id,
            edgeSessionNo:
              typeof sessionMetadata.edgeSessionNo === 'string'
                ? sessionMetadata.edgeSessionNo
                : session.sessionNo,
            cloudSessionId: session.id,
            cloudSessionNo: session.sessionNo,
            invoiceId: updatedInvoice.id,
            invoiceNo: updatedInvoice.invoiceNo,
            invoiceStatus: updatedInvoice.status,
            invoiceAmount: updatedInvoice.amount,
            invoicePaidAmount: updatedInvoice.paidAmount,
            invoiceUnpaidAmount: updatedInvoice.unpaidAmount,
            paymentStatus,
            paidAt: now.toISOString(),
            amount,
            transactionId: transaction?.id ?? null,
            transactionNo: transaction?.transactionNo ?? null,
            receipt,
          },
        });

        cloudToEdgeOutboxId = outbox.id;
      }
    }

    return {
      ok: true,
      action:
        updatedInvoice.unpaidAmount <= 0
          ? 'INVOICE_PAID'
          : 'INVOICE_PARTIALLY_PAID',
      invoiceId: updatedInvoice.id,
      invoiceNo: updatedInvoice.invoiceNo,
      amount,
      paidAmount: updatedInvoice.paidAmount,
      unpaidAmount: updatedInvoice.unpaidAmount,
      status: updatedInvoice.status,
      transactionId: transaction?.id ?? null,
      transactionNo: transaction?.transactionNo ?? null,
      receipt,
      cloudToEdgeOutboxId,
    };
  }

  async sendInvoiceSms(input: {
    invoiceId: string;
    recipient?: string;
    baseUrl?: string;
    message?: string;
  }) {
    this.assertCloudPaymentAuthority();

    const invoice = await this.prisma.invoice.findUnique({
      where: {
        id: input.invoiceId,
      },
      include: {
        session: true,
      },
    });

    if (!invoice) {
      throw new NotFoundException(`Invoice not found: ${input.invoiceId}`);
    }

    const session = (invoice as any).session;
    const sessionMetadata = this.asObject(session?.metadata) ?? {};
    const metadata = this.asObject(invoice.metadata) ?? {};
    const recipient =
      input.recipient ??
      session?.phone ??
      sessionMetadata.phone ??
      metadata.phone ??
      null;

    const linkResult = await this.createPaymentLink({
      invoiceId: invoice.id,
      baseUrl: input.baseUrl,
      channel: 'SMS',
      recipient: recipient ?? undefined,
    });

    const message =
      input.message ??
      `[Kosmos Parking] Unpaid invoice ${invoice.invoiceNo}: ${linkResult.paymentLinkUrl}`;

    const result = await this.recordCollectionAction({
      invoiceId: invoice.id,
      action: 'SEND_SMS',
      channel: 'SMS',
      recipient: recipient ?? undefined,
      note: 'SMS sent through dev provider',
      metadata: {
        provider: 'DEV_CONSOLE',
        deliveryStatus: 'DEV_RECORDED',
        actualDelivery: false,
        message,
        paymentLinkUrl: linkResult.paymentLinkUrl,
      },
    });

    return {
      ok: true,
      invoiceId: invoice.id,
      invoiceNo: invoice.invoiceNo,
      channel: 'SMS',
      recipient,
      paymentLinkUrl: linkResult.paymentLinkUrl,
      message,
      deliveryStatus: 'DEV_RECORDED',
      collectionStatus: result.collectionStatus,
    };
  }

  async sendInvoiceEmail(input: {
    invoiceId: string;
    recipient?: string;
    baseUrl?: string;
    subject?: string;
    message?: string;
  }) {
    this.assertCloudPaymentAuthority();

    const invoice = await this.prisma.invoice.findUnique({
      where: {
        id: input.invoiceId,
      },
      include: {
        session: true,
      },
    });

    if (!invoice) {
      throw new NotFoundException(`Invoice not found: ${input.invoiceId}`);
    }

    const session = (invoice as any).session;
    const sessionMetadata = this.asObject(session?.metadata) ?? {};
    const metadata = this.asObject(invoice.metadata) ?? {};
    const recipient =
      input.recipient ??
      session?.email ??
      sessionMetadata.email ??
      metadata.email ??
      null;

    const linkResult = await this.createPaymentLink({
      invoiceId: invoice.id,
      baseUrl: input.baseUrl,
      channel: 'EMAIL',
      recipient: recipient ?? undefined,
    });

    const subject =
      input.subject ?? `[Kosmos Parking] Unpaid invoice ${invoice.invoiceNo}`;

    const message =
      input.message ??
      [
        `Invoice No: ${invoice.invoiceNo}`,
        `Unpaid Amount: ${invoice.unpaidAmount} KRW`,
        `Payment Link: ${linkResult.paymentLinkUrl}`,
      ].join('\n');

    const result = await this.recordCollectionAction({
      invoiceId: invoice.id,
      action: 'SEND_EMAIL',
      channel: 'EMAIL',
      recipient: recipient ?? undefined,
      note: 'Email sent through dev provider',
      metadata: {
        provider: 'DEV_CONSOLE',
        deliveryStatus: 'DEV_RECORDED',
        actualDelivery: false,
        subject,
        message,
        paymentLinkUrl: linkResult.paymentLinkUrl,
      },
    });

    return {
      ok: true,
      invoiceId: invoice.id,
      invoiceNo: invoice.invoiceNo,
      channel: 'EMAIL',
      recipient,
      subject,
      message,
      paymentLinkUrl: linkResult.paymentLinkUrl,
      deliveryStatus: 'DEV_RECORDED',
      collectionStatus: result.collectionStatus,
    };
  }

  async recordCollectionAction(input: {
    invoiceId: string;
    action: string;
    channel?: string;
    recipient?: string;
    note?: string;
    metadata?: Record<string, unknown>;
  }) {
    this.assertCloudPaymentAuthority();

    const now = new Date();

    const action = this.normalizeCollectionAction(input.action);

    const invoice = (await this.prisma.invoice.findUnique({
      where: {
        id: input.invoiceId,
      },
    })) as InvoiceLike | null;

    if (!invoice) {
      throw new NotFoundException(`Invoice not found: ${input.invoiceId}`);
    }

    const currentMetadata = this.asObject(invoice.metadata) ?? {};

    const collectionStatus = this.collectionStatusForAction(action);

    const historyEntry = this.createCollectionHistoryEntry({
      action,
      channel: input.channel,
      recipient: input.recipient,
      note: input.note,
      createdAt: now,
      metadata: input.metadata,
    });

    const nextMetadata = this.appendCollectionAction({
      metadata: currentMetadata,
      action: historyEntry,
      collectionStatus,
      paymentLinkUrl:
        typeof currentMetadata.paymentLinkUrl === 'string'
          ? currentMetadata.paymentLinkUrl
          : undefined,
    });

    const updatedInvoice = await this.prisma.invoice.update({
      where: {
        id: invoice.id,
      },
      data: {
        metadata: nextMetadata as any,
      },
    });

    const updatedMetadata = this.asObject(updatedInvoice.metadata) ?? {};

    return {
      ok: true,
      invoiceId: updatedInvoice.id,
      invoiceNo: updatedInvoice.invoiceNo,
      collectionStatus,
      collectionLastAction: action,
      collectionLastActionAt: now.toISOString(),
      paymentLinkUrl:
        typeof updatedMetadata.paymentLinkUrl === 'string'
          ? updatedMetadata.paymentLinkUrl
          : null,
    };
  }

  async ensureInvoiceForSession(input: {
    sessionId: string;
    now?: Date;
    vehicleType?: string;
    isMember?: boolean;
    forceRecalculate?: boolean;
  }): Promise<{
    invoice: InvoiceLike;
    calculation: ParkingFeeCalculationResult;
  }> {
    const now = input.now ?? new Date();

    const session = await this.prisma.parkingSession.findUnique({
      where: {
        id: input.sessionId,
      },
      include: {
        ParkingSpace: {
          include: {
            section: {
              include: {
                parkingLot: {
                  include: {
                    feePolicies: {
                      where: {
                        isActive: true,
                      },
                      orderBy: [{ validFrom: 'desc' }, { createdAt: 'desc' }],
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

    if (!session) {
      throw new Error(`Parking session not found: ${input.sessionId}`);
    }

    const parkingLotId =
      (session as any).parkingLotId ??
      session.ParkingSpace?.section?.parkingLot?.id ??
      session.ParkingSpace?.section?.parkingLotId ??
      null;

    if (!parkingLotId) {
      throw new Error(
        `Cannot resolve parkingLotId for session: ${input.sessionId}`,
      );
    }

    const entryTime = session.entryTime
      ? new Date(session.entryTime)
      : now;

    const endTime = session.exitTime
      ? new Date(session.exitTime)
      : now;

    const totalMinutes = Math.max(
      0,
      Math.ceil((endTime.getTime() - entryTime.getTime()) / 60_000),
    );

    const calculation =
      await this.feePolicyService.calculateParkingFee({
        parkingLotId,
        totalMinutes,
        vehicleType: input.vehicleType,
        isMember: input.isMember,
        now,
      });

    const existing = await this.findBySessionId(input.sessionId);

    if (existing && !input.forceRecalculate) {
      return {
        invoice: existing,
        calculation,
      };
    }

    const parkingLotPolicy =
      session.ParkingSpace?.section?.parkingLot?.feePolicies?.[0] ?? null;

    const baseParkingAmount = Math.max(0, calculation.totalAmount);

    const directRegistrationDiscountAmount =
      this.calculateDirectRegistrationDiscount(session, parkingLotPolicy);

    const watcherRewardBasisAmount =
      this.calculateWatcherRewardBasis(session, parkingLotPolicy);

    const amount = Math.max(
      0,
      baseParkingAmount - directRegistrationDiscountAmount,
    );

    const totalDiscountAmount =
      calculation.discountAmount + directRegistrationDiscountAmount;

    const paidAmount = existing?.paidAmount ?? 0;
    const unpaidAmount = Math.max(0, amount - paidAmount);

    const status = this.resolveInvoiceStatus({
      amount,
      paidAmount,
      unpaidAmount,
      existingStatus: existing?.status,
    });

    const metadata = {
      ...(this.asObject(existing?.metadata) ?? {}),
      feeCalculation: {
        ...((calculation as any) ?? {}),
        baseParkingAmount,
        directRegistrationDiscountAmount,
        registrationGraceDiscountAmount: directRegistrationDiscountAmount,
        watcherRewardBasisAmount,
        finalAmount: amount,
      },
      recalculatedAt: now.toISOString(),
      source: 'INVOICE_SERVICE',
    };

    if (existing) {
      const invoice = await this.prisma.invoice.update({
        where: {
          id: existing.id,
        },
        data: {
          amount,
          discountAmount: totalDiscountAmount,
          paidAmount,
          unpaidAmount,
          baseParkingAmount,
          registrationGraceDiscountAmount: directRegistrationDiscountAmount,
          authorityRegistrationSurchargeAmount: 0,
          watcherRewardBasisAmount,
          finalAmount: amount,
          status: status as any,
          issuedAt: existing.issuedAt ?? now,
          paidAt: status === 'PAID' ? existing.paidAt ?? now : existing.paidAt,
          metadata,
        },
      });

      return {
        invoice: invoice as InvoiceLike,
        calculation,
      };
    }

    const invoice = await this.prisma.invoice.create({
      data: {
        invoiceNo: this.createInvoiceNo(now),
        sessionId: input.sessionId,
        status: status as any,
        amount,
        discountAmount: totalDiscountAmount,
        paidAmount,
        unpaidAmount,
        baseParkingAmount,
        registrationGraceDiscountAmount: directRegistrationDiscountAmount,
        authorityRegistrationSurchargeAmount: 0,
        watcherRewardBasisAmount,
        finalAmount: amount,
        issuedAt: now,
        paidAt: status === 'PAID' ? now : null,
        metadata,
      },
    });

    return {
      invoice: invoice as InvoiceLike,
      calculation,
    };
  }

  async ensureAdditionalFeeForGraceExpiredSession(input: {
    sessionId: string;
    now?: Date;
    vehicleType?: string;
    isMember?: boolean;
  }): Promise<{
    invoice: InvoiceLike;
    calculation: ParkingFeeCalculationResult;
    additionalFeeAmount: number;
    additionalFeeReason: string;
    exitGraceMinutes: number;
    exitGraceDeadline: string | null;
  }> {
    const now = input.now ?? new Date();

    const session = await this.prisma.parkingSession.findUnique({
      where: {
        id: input.sessionId,
      },
      include: {
        ParkingSpace: {
          include: {
            section: {
              include: {
                parkingLot: {
                  include: {
                    feePolicies: {
                      where: {
                        isActive: true,
                      },
                      orderBy: [{ validFrom: 'desc' }, { createdAt: 'desc' }],
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

    if (!session) {
      throw new Error(`Parking session not found: ${input.sessionId}`);
    }

    const existing = await this.findBySessionId(input.sessionId);

    /**
     * No invoice or not paid yet:
     * - normal exit billing path.
     */
    if (!existing || existing.paidAmount <= 0) {
      const { invoice, calculation } = await this.ensureInvoiceForSession({
        sessionId: input.sessionId,
        now,
        vehicleType: input.vehicleType,
        isMember: input.isMember,
        forceRecalculate: true,
      });

      return {
        invoice,
        calculation,
        additionalFeeAmount: invoice.unpaidAmount,
        additionalFeeReason:
          invoice.unpaidAmount > 0 ? 'UNPAID_BEFORE_EXIT' : 'NO_ADDITIONAL_FEE',
        exitGraceMinutes: 0,
        exitGraceDeadline: null,
      };
    }

    const invoiceMetadata = this.asObject(existing.metadata) ?? {};

    const paidAtValue =
      existing.paidAt ??
      (typeof invoiceMetadata.lastPaymentAppliedAt === 'string'
        ? new Date(invoiceMetadata.lastPaymentAppliedAt)
        : null) ??
      (typeof invoiceMetadata.paidViaPaymentLinkAt === 'string'
        ? new Date(invoiceMetadata.paidViaPaymentLinkAt)
        : null);

    const policy =
      session.ParkingSpace?.section?.parkingLot?.feePolicies?.[0] ?? null;

    const exitGraceMinutes =
      policy && Number.isFinite(Number((policy as any).exitGraceMinutes))
        ? Math.max(0, Math.floor(Number((policy as any).exitGraceMinutes)))
        : 10;

    const exitGraceDeadline =
      paidAtValue && !Number.isNaN(paidAtValue.getTime())
        ? new Date(paidAtValue.getTime() + exitGraceMinutes * 60_000)
        : null;

    /**
     * Paid and still within exit grace:
     * - keep already-paid invoice as-is.
     * - do not recalculate into additional fee.
     */
    if (
      existing.unpaidAmount <= 0 &&
      exitGraceDeadline &&
      now.getTime() <= exitGraceDeadline.getTime()
    ) {
      const metadata = {
        ...invoiceMetadata,
        paidExitGrace: {
          applied: true,
          reason: 'WITHIN_EXIT_GRACE',
          paidAt: paidAtValue?.toISOString() ?? null,
          exitGraceMinutes,
          exitGraceDeadline: exitGraceDeadline.toISOString(),
          checkedAt: now.toISOString(),
        },
        recalculatedAt: now.toISOString(),
        source: 'PAID_EXIT_GRACE',
      };

      const invoice = await this.prisma.invoice.update({
        where: {
          id: existing.id,
        },
        data: {
          metadata,
        },
      });

      const parkingLotIdForGraceCalculation =
        session.ParkingSpace?.section?.parkingLot?.id ??
        session.ParkingSpace?.section?.parkingLotId ??
        null;

      if (!parkingLotIdForGraceCalculation) {
        throw new Error(
          `Cannot resolve parkingLotId for session: ${input.sessionId}`,
        );
      }

      const calculation =
        await this.feePolicyService.calculateParkingFee({
          parkingLotId: parkingLotIdForGraceCalculation,
          totalMinutes: Math.max(
            0,
            Math.ceil(
              ((session.exitTime ? new Date(session.exitTime) : now).getTime() -
                (session.entryTime
                  ? new Date(session.entryTime)
                  : session.createdAt
                ).getTime()) /
                60_000,
            ),
          ),
          vehicleType: input.vehicleType,
          isMember: input.isMember,
          now,
        });

      return {
        invoice: invoice as InvoiceLike,
        calculation,
        additionalFeeAmount: 0,
        additionalFeeReason: 'WITHIN_EXIT_GRACE',
        exitGraceMinutes,
        exitGraceDeadline: exitGraceDeadline.toISOString(),
      };
    }

    /**
     * Paid, but grace expired:
     * - recalculate full fee at exit time.
     * - paidAmount remains as already paid.
     * - unpaidAmount becomes additional fee.
     */
    const { invoice, calculation } = await this.ensureInvoiceForSession({
      sessionId: input.sessionId,
      now,
      vehicleType: input.vehicleType,
      isMember: input.isMember,
      forceRecalculate: true,
    });

    const additionalFeeAmount = Math.max(0, invoice.unpaidAmount);

    const metadata = {
      ...(this.asObject(invoice.metadata) ?? {}),
      paidExitGrace: {
        applied: false,
        reason:
          additionalFeeAmount > 0
            ? 'EXIT_GRACE_EXPIRED_ADDITIONAL_FEE'
            : 'EXIT_GRACE_EXPIRED_NO_FEE_INCREASE',
        paidAt: paidAtValue?.toISOString() ?? null,
        exitGraceMinutes,
        exitGraceDeadline: exitGraceDeadline?.toISOString() ?? null,
        checkedAt: now.toISOString(),
        additionalFeeAmount,
      },
      feeCalculation: calculation,
      recalculatedAt: now.toISOString(),
      source: 'PAID_EXIT_GRACE_RECALCULATION',
    };

    const updatedInvoice = await this.prisma.invoice.update({
      where: {
        id: invoice.id,
      },
      data: {
        metadata,
      },
    });

    return {
      invoice: updatedInvoice as InvoiceLike,
      calculation,
      additionalFeeAmount,
      additionalFeeReason:
        additionalFeeAmount > 0
          ? 'EXIT_GRACE_EXPIRED_ADDITIONAL_FEE'
          : 'EXIT_GRACE_EXPIRED_NO_FEE_INCREASE',
      exitGraceMinutes,
      exitGraceDeadline: exitGraceDeadline?.toISOString() ?? null,
    };
  }

  async applyPayment(input: {
    invoiceId: string;
    amount: number;
    paidAt?: Date;
    metadata?: Record<string, unknown>;
  }): Promise<InvoiceLike> {
    const paidAt = input.paidAt ?? new Date();

    const invoice = (await this.prisma.invoice.findUnique({
      where: {
        id: input.invoiceId,
      },
    })) as InvoiceLike | null;

    if (!invoice) {
      throw new Error(`Invoice not found: ${input.invoiceId}`);
    }

    const nextPaidAmount = Math.min(
      invoice.amount,
      invoice.paidAmount + input.amount,
    );

    const nextUnpaidAmount = Math.max(
      0,
      invoice.amount - nextPaidAmount,
    );

    const nextStatus =
      nextUnpaidAmount <= 0
        ? 'PAID'
        : nextPaidAmount > 0
          ? 'PARTIALLY_PAID'
          : 'ISSUED';

    const metadata = {
      ...(this.asObject(invoice.metadata) ?? {}),
      ...(input.metadata ?? {}),
      lastPaymentAppliedAt: paidAt.toISOString(),
    };

    return this.prisma.invoice.update({
      where: {
        id: invoice.id,
      },
      data: {
        paidAmount: nextPaidAmount,
        unpaidAmount: nextUnpaidAmount,
        status: nextStatus as any,
        paidAt: nextStatus === 'PAID' ? paidAt : invoice.paidAt,
        metadata,
      },
    }) as Promise<InvoiceLike>;
  }

  async createPaymentTransaction(input: {
    invoiceId: string;
    parkingSessionId?: string | null;
    provider: string;
    method?: string | null;
    status?: string;
    amount: number;
    currency?: string;
    providerOrderId?: string | null;
    providerPaymentKey?: string | null;
    providerReference?: string | null;
    approvedAt?: Date | null;
    metadata?: Record<string, unknown>;
  }) {
    const now = new Date();

    return (this.prisma as any).paymentTransaction.create({
      data: {
        transactionNo: this.createTransactionNo(now),
        invoiceId: input.invoiceId,
        parkingSessionId: input.parkingSessionId ?? null,
        provider: input.provider,
        method: input.method ?? null,
        status: input.status ?? 'APPROVED',
        amount: input.amount,
        currency: input.currency ?? 'KRW',
        providerOrderId: input.providerOrderId ?? null,
        providerPaymentKey: input.providerPaymentKey ?? null,
        providerReference: input.providerReference ?? null,
        approvedAt: input.approvedAt ?? now,
        metadata: input.metadata ?? {},
      },
    });
  }

  private assertCloudPaymentAuthority() {
    const appMode = (process.env.APP_MODE ?? 'cloud').toLowerCase();
    const paymentAuthority = (
      process.env.PAYMENT_AUTHORITY ?? 'cloud'
    ).toLowerCase();

    if (appMode === 'edge' || paymentAuthority !== 'cloud') {
      throw new ForbiddenException(
        'Payment operations are only available in cloud mode',
      );
    }
  }

  private async createCloudToEdgeOutboxMessage(input: {
    edgeNodeId: string;
    eventType: string;
    aggregateType?: string;
    aggregateId?: string;
    payload: Record<string, unknown>;
  }) {
    const domainEvent = await this.prisma.domainEvent.create({
      data: {
        eventId: randomUUID(),
        aggregateType: input.aggregateType ?? 'Sync',
        aggregateId: input.aggregateId ?? input.edgeNodeId,
        eventType: input.eventType,
        payload: {
          ...input.payload,
          destination: `EDGE:${input.edgeNodeId}`,
          createdForEdgeSync: true,
        } as any,
        occurredAt: new Date(),
      },
    });

    return this.prisma.syncOutbox.create({
      data: {
        domainEventId: domainEvent.id,
        destination: `EDGE:${input.edgeNodeId}`,
        status: 'PENDING' as any,
      },
    });
  }

  private createCollectionHistoryEntry(input: {
    action: CollectionAction;
    channel?: string | null;
    recipient?: string | null;
    note?: string;
    createdAt: Date;
    metadata?: Record<string, unknown>;
  }) {
    return {
      id: randomId(),
      action: input.action,
      channel: input.channel ?? null,
      recipient: input.recipient ?? null,
      note: input.note ?? null,
      metadata: input.metadata ?? {},
      createdAt: input.createdAt.toISOString(),
    };
  }

  private appendCollectionAction(input: {
    metadata: Record<string, any>;
    action: Record<string, unknown>;
    collectionStatus: string;
    paymentLinkUrl?: string;
  }) {
    const history = Array.isArray(input.metadata.collectionHistory)
      ? input.metadata.collectionHistory
      : [];

    return {
      ...input.metadata,
      paymentLinkUrl:
        input.paymentLinkUrl ?? input.metadata.paymentLinkUrl ?? null,
      collectionStatus: input.collectionStatus,
      collectionLastAction: input.action.action,
      collectionLastActionAt: input.action.createdAt,
      collectionHistory: [input.action, ...history].slice(0, 50),
    };
  }

  private normalizeCollectionAction(value: string): CollectionAction {
    const normalized = String(value ?? '').trim().toUpperCase();

    if (
      normalized === 'CREATE_PAYMENT_LINK' ||
      normalized === 'COPY_PAYMENT_LINK' ||
      normalized === 'SEND_SMS' ||
      normalized === 'SEND_EMAIL' ||
      normalized === 'CALL_DRIVER' ||
      normalized === 'MARK_CONTACTED' ||
      normalized === 'PUBLIC_PAYMENT_COMPLETED'
    ) {
      return normalized;
    }

    return 'MARK_CONTACTED';
  }

  private collectionStatusForAction(action: CollectionAction) {
    switch (action) {
      case 'CREATE_PAYMENT_LINK':
        return 'LINK_CREATED';
      case 'COPY_PAYMENT_LINK':
        return 'LINK_COPIED';
      case 'SEND_SMS':
        return 'SMS_SENT';
      case 'SEND_EMAIL':
        return 'EMAIL_SENT';
      case 'CALL_DRIVER':
        return 'CALLED';
      case 'MARK_CONTACTED':
        return 'CONTACTED';
      case 'PUBLIC_PAYMENT_COMPLETED':
        return 'PAID';
      default:
        return 'READY';
    }
  }

  private normalizeBaseUrl(_value?: string) {
    const fallback =
      process.env.PUBLIC_CLOUD_WEB_BASE_URL ??
      process.env.PUBLIC_WEB_BASE_URL ??
      process.env.WEB_BASE_URL ??
      'http://localhost:4000';

    return fallback.replace(/\/+$/, '');
  }

  private resolveCollectionPaymentStatus(input: {
    invoiceStatus: string;
    paidAmount: number;
    unpaidAmount: number;
  }) {
    if (input.unpaidAmount <= 0) {
      return 'PAID';
    }

    if (input.paidAmount > 0) {
      return 'PARTIALLY_PAID';
    }

    if (input.invoiceStatus === 'OVERDUE') {
      return 'OVERDUE';
    }

    return 'UNPAID';
  }

  private resolveInvoiceStatus(input: {
    amount: number;
    paidAmount: number;
    unpaidAmount: number;
    existingStatus?: string;
  }): InvoiceStatusLike {
    if (
      input.existingStatus === 'VOID' ||
      input.existingStatus === 'CANCELLED'
    ) {
      return input.existingStatus;
    }

    if (input.amount <= 0) {
      return 'PAID';
    }

    if (input.unpaidAmount <= 0) {
      return 'PAID';
    }

    if (input.paidAmount > 0) {
      return 'PARTIALLY_PAID';
    }

    return 'ISSUED';
  }

  private createInvoiceNo(now: Date) {
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    const random = Math.random().toString(36).slice(2, 10).toUpperCase();

    return `INV-${y}${m}${d}-${random}`;
  }

  private createTransactionNo(now: Date) {
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    const random = Math.random().toString(36).slice(2, 10).toUpperCase();

    return `PTX-${y}${m}${d}-${random}`;
  }

  private createReceiptNo(now: Date) {
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    const random = Math.random().toString(36).slice(2, 10).toUpperCase();

    return `RCT-${y}${m}${d}-${random}`;
  }

  private getGraceOverstayMinFee() {
    const raw = process.env.PAID_EXIT_GRACE_OVERSTAY_MIN_FEE;
    const parsed = raw ? Number(raw) : 500;

    if (!Number.isFinite(parsed) || parsed < 0) {
      return 500;
    }

    return Math.floor(parsed);
  }

  private asObject(value: unknown): Record<string, any> | null {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return null;
    }

    return value as Record<string, any>;
  }
}

function randomId() {
  return Math.random().toString(36).slice(2, 12);
}