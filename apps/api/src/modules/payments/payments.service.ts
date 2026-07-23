import { isEdgeRuntimeProfile } from '../../common/config/app-mode';
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  InvoiceStatus,
  PaymentMethod,
  PaymentStatus,
  SessionStatus,
} from '@parking/db';
import { randomUUID } from 'crypto';
import { WsEvents } from '@parking/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { RealtimePublisherService } from '../realtime/realtime-publisher.service';
import { ConfirmPaymentDto } from './dto/confirm-payment.dto';
import { TossConfirmDto } from './dto/toss-confirm.dto';
import { TossWebhookDto } from './dto/toss-webhook.dto';
import { ConfirmTossPaymentDto } from './dto/confirm-toss-payment.dto';
import { PublicConfirmTossPaymentDto } from './dto/public-confirm-toss-payment.dto';
import { InvoicesService } from '../invoices/invoices.service';
import { TenantCouponsService } from '../tenants/tenant-coupons.service';

@Injectable()
export class PaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly realtimePublisher: RealtimePublisherService,
    private readonly invoicesService: InvoicesService,
    private readonly tenantCouponsService: TenantCouponsService,
  ) {}

  async mockCompleteSessionPayment(
    userId: string,
    dto: {
      sessionId: string;
      amount?: number;
      paymentMethod?: string;
      paymentReference?: string;
    },
  ) {
    this.assertCloudPaymentAuthority();

    if (!dto.sessionId) {
      throw new BadRequestException('sessionId is required');
    }

    const session = await this.prisma.parkingSession.findUnique({
      where: {
        id: dto.sessionId,
      },
    });

    if (!session) {
      throw new NotFoundException('Parking session not found');
    }

    const metadata = this.asRecord(session.metadata);
    const sessionStatus = String(session.status);
    const now = new Date();

    const currentPaidExitGraceUntil =
      typeof metadata.paidExitGraceUntil === 'string'
        ? new Date(metadata.paidExitGraceUntil)
        : null;

    const hasPaidExitGraceExpired =
      currentPaidExitGraceUntil != null &&
      !Number.isNaN(currentPaidExitGraceUntil.getTime()) &&
      currentPaidExitGraceUntil.getTime() <= now.getTime();

    const isActiveSession =
      sessionStatus === 'ACTIVE' ||
      sessionStatus === 'GRACE_PERIOD' ||
      sessionStatus === 'CREATED';

    const isClosedUnpaid =
      metadata.paymentRequired === true &&
      metadata.paymentStatus === 'UNPAID' &&
      metadata.exitedUnpaid === true;

    const isActiveRegistered =
      isActiveSession && session.isRegistered === true;

    const isActiveGraceExpiredAdditionalPayment =
      isActiveRegistered &&
      metadata.paymentStatus === 'PAID' &&
      metadata.paidBeforeExit === true &&
      (metadata.paymentGraceExpired === true || hasPaidExitGraceExpired);

    const alreadyPaidAndClosed =
      !isActiveSession &&
      metadata.paymentStatus === 'PAID' &&
      metadata.exitedUnpaid !== true;

    if (alreadyPaidAndClosed) {
      return {
        ok: true,
        alreadyPaid: true,
        sessionId: session.id,
        sessionNo: session.sessionNo,
        paymentStatus: 'PAID',
        invoiceId: metadata.invoiceId ?? null,
        invoiceNo: metadata.invoiceNo ?? null,
      };
    }

    if (
      isActiveSession &&
      metadata.paymentStatus === 'PAID' &&
      metadata.paidBeforeExit === true &&
      metadata.paymentGraceExpired !== true &&
      !hasPaidExitGraceExpired
    ) {
      return {
        ok: true,
        alreadyPaid: true,
        sessionId: session.id,
        sessionNo: session.sessionNo,
        paymentStatus: 'PAID',
        paidBeforeExit: true,
        paidExitGraceUntil: metadata.paidExitGraceUntil ?? null,
        invoiceId: metadata.invoiceId ?? null,
        invoiceNo: metadata.invoiceNo ?? null,
      };
    }

    if (
      !isClosedUnpaid &&
      !isActiveRegistered &&
      !isActiveGraceExpiredAdditionalPayment
    ) {
      throw new BadRequestException(
        'Parking session is not payable in its current state',
      );
    }

    const paidAt = new Date();
    const paidExitGraceMinutes = this.getPaidExitGraceMinutes();
    const nextPaidExitGraceUntil = new Date(
      paidAt.getTime() + paidExitGraceMinutes * 60 * 1000,
    );

    const paidBeforeExit =
      isActiveRegistered || isActiveGraceExpiredAdditionalPayment;

    const isAdditionalFeeBeforeExit =
      isActiveGraceExpiredAdditionalPayment;

    const paymentMethod = dto.paymentMethod ?? 'MOCK';
    const paymentReference = dto.paymentReference ?? `MOCK-${Date.now()}`;

    const shouldEnsureAdditionalFee =
      isAdditionalFeeBeforeExit ||
      (isClosedUnpaid &&
        (metadata.additionalFeeRequired === true ||
          metadata.paymentReason === 'PAID_GRACE_EXPIRED_ADDITIONAL_FEE'));

    const invoiceBundle = shouldEnsureAdditionalFee
      ? await this.invoicesService.ensureAdditionalFeeForGraceExpiredSession({
          sessionId: session.id,
        })
      : await this.invoicesService.ensureInvoiceForSession({
          sessionId: session.id,
          forceRecalculate: true,
        });

    const invoice = invoiceBundle.invoice;
    const calculation = invoiceBundle.calculation;

    await this.tenantCouponsService.assertInvoiceCouponReservation({
      sessionId: session.id,
      invoiceMetadata: invoice.metadata,
    });

    const amount = this.resolveMockPaymentAmount({
      dtoAmount: dto.amount,
      invoiceAmount: invoice.amount,
      invoiceUnpaidAmount: invoice.unpaidAmount,
      sessionUnpaidAmount: Number((session as any).unpaidAmount ?? 0),
    });

    if (amount <= 0) {
      throw new BadRequestException('Payable amount must be greater than 0');
    }

    await this.invoicesService.createPaymentTransaction({
      invoiceId: invoice.id,
      parkingSessionId: session.id,
      provider: 'MOCK',
      method: paymentMethod,
      status: 'APPROVED',
      amount,
      providerReference: paymentReference,
      approvedAt: paidAt,
      metadata: {
        source: 'mockCompleteSessionPayment',
        userId,
        paidBeforeExit,
        isAdditionalFeeBeforeExit,
        isUnpaidInvoicePayment: isClosedUnpaid,
        sessionId: session.id,
        sessionNo: session.sessionNo,
        feeCalculation: calculation,
        previousPaidExitGraceUntil:
          currentPaidExitGraceUntil != null &&
          !Number.isNaN(currentPaidExitGraceUntil.getTime())
            ? currentPaidExitGraceUntil.toISOString()
            : null,
        hasPaidExitGraceExpired,
        additionalFeeAmount:
          'additionalFeeAmount' in invoiceBundle
            ? invoiceBundle.additionalFeeAmount
            : null,
        additionalFeeReason:
          'additionalFeeReason' in invoiceBundle
            ? invoiceBundle.additionalFeeReason
            : null,
      },
    });

    const paidInvoice = await this.invoicesService.applyPayment({
      invoiceId: invoice.id,
      amount,
      paidAt,
      metadata: {
        source: 'mockCompleteSessionPayment',
        userId,
        paidBeforeExit,
        isAdditionalFeeBeforeExit,
        isUnpaidInvoicePayment: isClosedUnpaid,
        paymentReference,
      },
    });

    if (paidInvoice.unpaidAmount <= 0) {
      await this.tenantCouponsService.completeReservedCouponForInvoice({
        sessionId: session.id,
        invoiceId: paidInvoice.id,
        actorUserId: userId,
      });
    }

    const paymentReason = isAdditionalFeeBeforeExit
      ? 'PAID_GRACE_EXPIRED_ADDITIONAL_FEE_BEFORE_EXIT'
      : paidBeforeExit
        ? 'PAID_BEFORE_EXIT'
        : 'EXITED_UNPAID_PAID';

    const nextMetadata = {
      ...metadata,
      paymentStatus: paidInvoice.unpaidAmount <= 0 ? 'PAID' : 'PARTIALLY_PAID',
      paymentRequired: paidInvoice.unpaidAmount > 0,
      exitedUnpaid: paidInvoice.unpaidAmount > 0 && !paidBeforeExit,
      paidAt: paidAt.toISOString(),
      paidByUserId: userId,
      paidBeforeExit,
      isAdditionalFeeBeforeExit,
      isUnpaidInvoicePayment: isClosedUnpaid,
      paidExitGraceMinutes: paidBeforeExit
        ? paidExitGraceMinutes
        : metadata.paidExitGraceMinutes ?? null,
      paidExitGraceUntil: paidBeforeExit
        ? nextPaidExitGraceUntil.toISOString()
        : metadata.paidExitGraceUntil ?? null,
      previousPaidExitGraceUntil:
        currentPaidExitGraceUntil != null &&
        !Number.isNaN(currentPaidExitGraceUntil.getTime())
          ? currentPaidExitGraceUntil.toISOString()
          : null,
      paymentGraceExpired: false,
      paymentGraceExpiredAt: null,
      additionalFeeRequired: false,
      paymentReason,
      invoiceId: paidInvoice.id,
      invoiceNo: paidInvoice.invoiceNo,
      invoiceStatus: paidInvoice.status,
      invoiceAmount: paidInvoice.amount,
      invoicePaidAmount: paidInvoice.paidAmount,
      invoiceUnpaidAmount: paidInvoice.unpaidAmount,
      feeCalculation: calculation,
      additionalFeeAmount:
        'additionalFeeAmount' in invoiceBundle
          ? invoiceBundle.additionalFeeAmount
          : null,
      additionalFeeReason:
        'additionalFeeReason' in invoiceBundle
          ? invoiceBundle.additionalFeeReason
          : null,
      mockPayment: {
        amount,
        method: paymentMethod,
        reference: paymentReference,
        paidAt: paidAt.toISOString(),
        isAdditionalFeeBeforeExit,
        isUnpaidInvoicePayment: isClosedUnpaid,
      },
    };

    const sessionPaidAmount =
      paidInvoice.paidAmount > 0 ? paidInvoice.paidAmount : amount;

    const sessionUnpaidAmount = Math.max(0, paidInvoice.unpaidAmount);

    const shouldMarkSessionPaid =
      !paidBeforeExit && sessionUnpaidAmount <= 0;

    const eventType = isAdditionalFeeBeforeExit
      ? 'PAYMENT_ADDITIONAL_FEE_COMPLETED_BEFORE_EXIT'
      : paidBeforeExit
        ? 'PAYMENT_COMPLETED_BEFORE_EXIT'
        : 'PAYMENT_COMPLETED';

    const domainEventType = isAdditionalFeeBeforeExit
      ? 'PARKING_SESSION_ADDITIONAL_FEE_PAID_BEFORE_EXIT'
      : paidBeforeExit
        ? 'PARKING_SESSION_PAYMENT_COMPLETED_BEFORE_EXIT'
        : 'PARKING_SESSION_PAYMENT_COMPLETED';

    const updatedSession = await this.prisma.parkingSession.update({
      where: {
        id: session.id,
      },
      data: {
        status: shouldMarkSessionPaid
          ? SessionStatus.PAID
          : paidBeforeExit
            ? (session.status as any)
            : SessionStatus.CLOSED,
        paidAmount: sessionPaidAmount,
        unpaidAmount: sessionUnpaidAmount,
        metadata: nextMetadata as any,
        events: {
          create: {
            type: eventType,
            source: 'MOCK_PAYMENT',
            payload: {
              sessionId: session.id,
              sessionNo: session.sessionNo,
              amount,
              paymentMethod,
              paymentReference,
              paidByUserId: userId,
              paidAt: paidAt.toISOString(),
              paidBeforeExit,
              isAdditionalFeeBeforeExit,
              isUnpaidInvoicePayment: isClosedUnpaid,
              paidExitGraceMinutes: paidBeforeExit
                ? paidExitGraceMinutes
                : null,
              paidExitGraceUntil: paidBeforeExit
                ? nextPaidExitGraceUntil.toISOString()
                : null,
              previousPaidExitGraceUntil:
                currentPaidExitGraceUntil != null &&
                !Number.isNaN(currentPaidExitGraceUntil.getTime())
                  ? currentPaidExitGraceUntil.toISOString()
                  : null,
              hasPaidExitGraceExpired,
              invoiceId: paidInvoice.id,
              invoiceNo: paidInvoice.invoiceNo,
              invoiceStatus: paidInvoice.status,
              invoiceAmount: paidInvoice.amount,
              invoicePaidAmount: paidInvoice.paidAmount,
              invoiceUnpaidAmount: paidInvoice.unpaidAmount,
              additionalFeeAmount:
                'additionalFeeAmount' in invoiceBundle
                  ? invoiceBundle.additionalFeeAmount
                  : null,
              additionalFeeReason:
                'additionalFeeReason' in invoiceBundle
                  ? invoiceBundle.additionalFeeReason
                  : null,
            } as any,
          },
        },
      },
    });

    await this.prisma.domainEvent.create({
      data: {
        eventId: randomUUID(),
        aggregateType: 'ParkingSession',
        aggregateId: updatedSession.id,
        eventType: domainEventType,
        payload: {
          sessionId: updatedSession.id,
          sessionNo: updatedSession.sessionNo,
          amount,
          paymentMethod,
          paymentReference,
          paidByUserId: userId,
          paidAt: paidAt.toISOString(),
          paidBeforeExit,
          isAdditionalFeeBeforeExit,
          isUnpaidInvoicePayment: isClosedUnpaid,
          paidExitGraceMinutes: paidBeforeExit
            ? paidExitGraceMinutes
            : null,
          paidExitGraceUntil: paidBeforeExit
            ? nextPaidExitGraceUntil.toISOString()
            : null,
          previousPaidExitGraceUntil:
            currentPaidExitGraceUntil != null &&
            !Number.isNaN(currentPaidExitGraceUntil.getTime())
              ? currentPaidExitGraceUntil.toISOString()
              : null,
          hasPaidExitGraceExpired,
          invoiceId: paidInvoice.id,
          invoiceNo: paidInvoice.invoiceNo,
          invoiceStatus: paidInvoice.status,
          invoiceAmount: paidInvoice.amount,
          invoicePaidAmount: paidInvoice.paidAmount,
          invoiceUnpaidAmount: paidInvoice.unpaidAmount,
          additionalFeeAmount:
            'additionalFeeAmount' in invoiceBundle
              ? invoiceBundle.additionalFeeAmount
              : null,
          additionalFeeReason:
            'additionalFeeReason' in invoiceBundle
              ? invoiceBundle.additionalFeeReason
              : null,
        } as any,
        occurredAt: paidAt,
      },
    });

    await this.realtimePublisher.publish(WsEvents.PAYMENT_UPDATED, {
      sessionId: updatedSession.id,
      status: paidInvoice.unpaidAmount <= 0 ? 'PAID' : 'PARTIALLY_PAID',
      amount,
      paymentReference,
      paidBeforeExit,
      isAdditionalFeeBeforeExit,
      isUnpaidInvoicePayment: isClosedUnpaid,
      paidExitGraceUntil: paidBeforeExit
        ? nextPaidExitGraceUntil.toISOString()
        : null,
      previousPaidExitGraceUntil:
        currentPaidExitGraceUntil != null &&
        !Number.isNaN(currentPaidExitGraceUntil.getTime())
          ? currentPaidExitGraceUntil.toISOString()
          : null,
      hasPaidExitGraceExpired,
      invoiceId: paidInvoice.id,
      invoiceNo: paidInvoice.invoiceNo,
      invoiceStatus: paidInvoice.status,
      invoicePaidAmount: paidInvoice.paidAmount,
      invoiceUnpaidAmount: paidInvoice.unpaidAmount,
    });

    await this.realtimePublisher.publish(WsEvents.INVOICE_UPDATED, {
      invoiceId: paidInvoice.id,
      invoiceNo: paidInvoice.invoiceNo,
      sessionId: updatedSession.id,
      status: paidInvoice.status,
      paidAmount: paidInvoice.paidAmount,
      unpaidAmount: paidInvoice.unpaidAmount,
    });

    await this.realtimePublisher.publish(WsEvents.SESSION_CLOSED, {
      sessionId: updatedSession.id,
      status: updatedSession.status,
      invoiceId: paidInvoice.id,
    });

    return {
      ok: true,
      action: isAdditionalFeeBeforeExit
        ? 'SESSION_ADDITIONAL_FEE_COMPLETED_BEFORE_EXIT'
        : paidBeforeExit
          ? 'SESSION_PAYMENT_COMPLETED_BEFORE_EXIT'
          : 'SESSION_PAYMENT_COMPLETED',
      sessionId: updatedSession.id,
      sessionNo: updatedSession.sessionNo,
      paymentStatus:
        paidInvoice.unpaidAmount <= 0 ? 'PAID' : 'PARTIALLY_PAID',
      exitedUnpaid: false,
      paidBeforeExit,
      isAdditionalFeeBeforeExit,
      isUnpaidInvoicePayment: isClosedUnpaid,
      paidExitGraceMinutes: paidBeforeExit
        ? paidExitGraceMinutes
        : null,
      paidExitGraceUntil: paidBeforeExit
        ? nextPaidExitGraceUntil.toISOString()
        : null,
      previousPaidExitGraceUntil:
        currentPaidExitGraceUntil != null &&
        !Number.isNaN(currentPaidExitGraceUntil.getTime())
          ? currentPaidExitGraceUntil.toISOString()
          : null,
      hasPaidExitGraceExpired,
      amount,
      paymentReference,
      invoice: {
        id: paidInvoice.id,
        invoiceNo: paidInvoice.invoiceNo,
        status: paidInvoice.status,
        amount: paidInvoice.amount,
        paidAmount: paidInvoice.paidAmount,
        unpaidAmount: paidInvoice.unpaidAmount,
      },
    };
  }

  async confirm(dto: ConfirmPaymentDto) {
    this.assertCloudPaymentAuthority();

    const invoice = await this.prisma.invoice.findUnique({
      where: { id: dto.invoiceId },
      include: {
        session: true,
        payments: true,
      },
    });

    if (!invoice) {
      throw new NotFoundException('Invoice not found');
    }

    if (invoice.unpaidAmount !== dto.amount) {
      throw new BadRequestException(
        'Amount does not match invoice unpaid amount',
      );
    }

    await this.tenantCouponsService.assertInvoiceCouponReservation({
      sessionId: invoice.sessionId,
      invoiceMetadata: invoice.metadata,
    });

    const result = await this.prisma.$transaction(async (tx) => {
      const payment = await tx.payment.create({
        data: {
          orderId: dto.orderId,
          invoiceId: dto.invoiceId,
          amount: dto.amount,
          method: PaymentMethod.TOSS,
          status: PaymentStatus.SUCCESS,
          tossPaymentKey: dto.tossPaymentKey,
          approvedAt: new Date(),
          rawResponse: {
            source: 'manual-confirm',
          } as any,
        },
      });

      const updatedInvoice = await tx.invoice.update({
        where: { id: dto.invoiceId },
        data: {
          status: InvoiceStatus.PAID,
          paidAmount: invoice.amount,
          unpaidAmount: 0,
          paidAt: new Date(),
        },
      });

      const updatedSession = await tx.parkingSession.update({
        where: { id: invoice.sessionId },
        data: {
          status: SessionStatus.PAID,
          paidAmount: invoice.amount,
          unpaidAmount: 0,
        },
      });

      await tx.domainEvent.create({
        data: {
          eventId: randomUUID(),
          aggregateType: 'Payment',
          aggregateId: payment.id,
          eventType: 'payment.confirmed',
          payload: {
            paymentId: payment.id,
            invoiceId: dto.invoiceId,
            sessionId: invoice.sessionId,
            amount: dto.amount,
          } as any,
          occurredAt: new Date(),
        },
      });

      return {
        payment,
        invoice: updatedInvoice,
        session: updatedSession,
      };
    });

    await this.tenantCouponsService.completeReservedCouponForInvoice({
      sessionId: result.session.id,
      invoiceId: result.invoice.id,
    });

    await this.publishPaymentConfirmedRealtime(result);

    return result;
  }

  async confirmTossPayment(userId: string, dto: ConfirmTossPaymentDto) {
    this.assertCloudPaymentAuthority();

    const payment = await this.prisma.payment.findFirst({
      where: {
        orderId: dto.orderId,
      },
      include: {
        invoice: {
          include: {
            session: {
              include: {
                user: {
                  select: {
                    id: true,
                    name: true,
                    email: true,
                    phone: true,
                  },
                },
              },
            },
          },
        },
        receipt: true,
      },
    });

    if (!payment) {
      throw new NotFoundException('Payment not found');
    }

    if (payment.amount !== dto.amount) {
      throw new BadRequestException('Payment amount mismatch');
    }

    if (!payment.invoice) {
      throw new BadRequestException('Payment invoice relation is missing');
    }

    if (payment.status === PaymentStatus.SUCCESS) {
      await this.tenantCouponsService.completeReservedCouponForInvoice({
        sessionId: payment.invoice.sessionId,
        invoiceId: payment.invoice.id,
        actorUserId: userId,
      });
      return {
        ok: true,
        alreadyConfirmed: true,
        userId,
        payment,
      };
    }

    await this.tenantCouponsService.assertInvoiceCouponReservation({
      sessionId: payment.invoice.sessionId,
      invoiceMetadata: payment.invoice.metadata,
    });

    const result = await this.prisma.$transaction(async (tx) => {
      const savedPayment = await tx.payment.update({
        where: { id: payment.id },
        data: {
          status: PaymentStatus.SUCCESS,
          approvedAt: new Date(),
          method: PaymentMethod.TOSS,
          tossPaymentKey: dto.paymentKey,
          tossOrderId: dto.orderId,
          rawResponse: {
            source: 'mobile-confirm',
            paymentKey: dto.paymentKey,
            orderId: dto.orderId,
            amount: dto.amount,
            userId,
          } as any,
        },
      });

      const updatedInvoice = await tx.invoice.update({
        where: { id: payment.invoiceId },
        data: {
          status: InvoiceStatus.PAID,
          paidAmount: payment.invoice!.amount,
          unpaidAmount: 0,
          paidAt: new Date(),
        },
      });

      const updatedSession = await tx.parkingSession.update({
        where: { id: payment.invoice!.sessionId },
        data: {
          status: SessionStatus.PAID,
          paidAmount: payment.invoice!.amount,
          unpaidAmount: 0,
        },
      });

      await tx.domainEvent.create({
        data: {
          eventId: randomUUID(),
          aggregateType: 'Payment',
          aggregateId: savedPayment.id,
          eventType: 'payment.mobile_toss_confirmed',
          payload: {
            paymentId: savedPayment.id,
            invoiceId: updatedInvoice.id,
            sessionId: updatedSession.id,
            paymentKey: dto.paymentKey,
            orderId: dto.orderId,
            userId,
          } as any,
          occurredAt: new Date(),
        },
      });

      return {
        payment: savedPayment,
        invoice: updatedInvoice,
        session: updatedSession,
      };
    });

    await this.tenantCouponsService.completeReservedCouponForInvoice({
      sessionId: result.session.id,
      invoiceId: result.invoice.id,
      actorUserId: userId,
    });

    await this.publishPaymentConfirmedRealtime(result);

    await this.ensureReceiptForSuccessfulPayment(result.payment.id);

    return {
      ok: true,
      userId,
      payment: result.payment,
      invoice: result.invoice,
      session: result.session,
    };
  }

  private getTossApiBaseUrl() {
    return (process.env.TOSS_API_BASE_URL ?? 'https://api.tosspayments.com').replace(/\/+$/, '');
  }

  private getTossSecretKey() {
    const secretKey = process.env.TOSS_SECRET_KEY;

    if (!secretKey) {
      throw new BadRequestException('TOSS_SECRET_KEY is not configured');
    }

    return secretKey;
  }

  private encodeTossBasicAuth(secretKey: string) {
    return Buffer.from(`${secretKey}:`, 'utf8').toString('base64');
  }

  private parseTossApprovedAt(payload: Record<string, any>) {
    const approvedAt = payload?.approvedAt;

    if (typeof approvedAt !== 'string') return null;

    const date = new Date(approvedAt);

    return Number.isNaN(date.getTime()) ? null : date;
  }

  private resolveTossApprovedAmount(payload: Record<string, any>) {
    return Number(payload?.totalAmount ?? payload?.amount ?? payload?.balanceAmount ?? 0);
  }

  private resolveTossFailureCode(error: unknown) {
    if (error instanceof BadRequestException) {
      const response = error.getResponse();

      if (typeof response === 'object' && response && 'code' in response) {
        return String((response as any).code);
      }
    }

    return 'TOSS_CONFIRM_FAILED';
  }

  private resolveTossFailureMessage(error: unknown) {
    if (error instanceof Error) return error.message;
    return 'Toss 결제 승인에 실패했습니다.';
  }

  private serializeTossError(error: unknown) {
    if (error instanceof BadRequestException) {
      return {
        name: error.name,
        message: error.message,
        response: error.getResponse(),
      };
    }

    if (error instanceof Error) {
      return {
        name: error.name,
        message: error.message,
        stack: error.stack,
      };
    }

    return {
      message: String(error),
    };
  }

  private async confirmTossWithProvider(input: {
    paymentKey: string;
    orderId: string;
    amount: number;
  }) {
    const response = await fetch(`${this.getTossApiBaseUrl()}/v1/payments/confirm`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${this.encodeTossBasicAuth(this.getTossSecretKey())}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        paymentKey: input.paymentKey,
        orderId: input.orderId,
        amount: input.amount,
      }),
    });

    const rawText = await response.text();
    let payload: Record<string, any>;

    try {
      payload = rawText ? JSON.parse(rawText) : {};
    } catch {
      payload = {
        rawText,
      };
    }

    if (!response.ok) {
      throw new BadRequestException({
        message: payload?.message ?? 'Toss 결제 승인 API 호출에 실패했습니다.',
        code: payload?.code ?? `HTTP_${response.status}`,
        tossResponse: payload,
      });
    }

    if (payload?.orderId !== input.orderId) {
      throw new BadRequestException({
        message: 'Toss 승인 응답의 orderId가 요청값과 다릅니다.',
        code: 'TOSS_ORDER_ID_MISMATCH',
        tossResponse: payload,
      });
    }

    const approvedAmount = this.resolveTossApprovedAmount(payload);

    if (approvedAmount !== input.amount) {
      throw new BadRequestException({
        message: 'Toss 승인 응답의 결제 금액이 요청 금액과 다릅니다.',
        code: 'TOSS_AMOUNT_MISMATCH',
        expectedAmount: input.amount,
        approvedAmount,
        tossResponse: payload,
      });
    }

    if (payload?.status !== 'DONE') {
      throw new BadRequestException({
        message: `Toss 결제 상태가 DONE이 아닙니다: ${payload?.status ?? '-'}`,
        code: 'TOSS_STATUS_NOT_DONE',
        tossResponse: payload,
      });
    }

    return payload;
  }

  async publicConfirmTossPayment(dto: PublicConfirmTossPaymentDto) {
    this.assertCloudPaymentAuthority();

    const payment = await this.prisma.payment.findFirst({
      where: {
        orderId: dto.orderId,
        invoiceId: dto.invoiceId,
      },
      include: {
        invoice: {
          include: {
            session: true,
          },
        },
      },
    });

    if (!payment) {
      throw new NotFoundException('Payment not found');
    }

    if (payment.amount !== dto.amount) {
      throw new BadRequestException('Payment amount mismatch');
    }

    if (!payment.invoice) {
      throw new BadRequestException('Payment invoice relation is missing');
    }

    if (payment.invoiceId !== dto.invoiceId) {
      throw new BadRequestException('Invoice mismatch');
    }

    if (payment.status === PaymentStatus.SUCCESS) {
      await this.tenantCouponsService.completeReservedCouponForInvoice({
        sessionId: payment.invoice.sessionId,
        invoiceId: payment.invoice.id,
      });
      return {
        ok: true,
        alreadyConfirmed: true,
        payment,
        invoice: payment.invoice,
      };
    }

    if (payment.status !== PaymentStatus.PENDING) {
      throw new BadRequestException(
        'Payment is no longer pending. Prepare a new payment and try again.',
      );
    }

    if (
      Number(payment.invoice.unpaidAmount ?? 0) !== dto.amount ||
      Number(payment.invoice.finalAmount ?? 0) -
        Number(payment.invoice.paidAmount ?? 0) !==
        dto.amount
    ) {
      throw new BadRequestException(
        'Invoice amount changed. Prepare a new payment and try again.',
      );
    }

    await this.tenantCouponsService.assertInvoiceCouponReservation({
      sessionId: payment.invoice.sessionId,
      invoiceMetadata: payment.invoice.metadata,
    });

    let tossApprovedPayment: Record<string, any>;

    try {
      tossApprovedPayment = await this.confirmTossWithProvider({
        paymentKey: dto.paymentKey,
        orderId: dto.orderId,
        amount: dto.amount,
      });
    } catch (error) {
      await this.prisma.payment
        .update({
          where: {
            id: payment.id,
          },
          data: {
            status: PaymentStatus.FAILED,
            failedAt: new Date(),
            failureCode: this.resolveTossFailureCode(error),
            failureMessage: this.resolveTossFailureMessage(error),
            rawResponse: {
              source: 'public-toss-confirm',
              paymentKey: dto.paymentKey,
              orderId: dto.orderId,
              amount: dto.amount,
              invoiceId: dto.invoiceId,
              error: this.serializeTossError(error),
            } as any,
          },
        })
        .catch(() => undefined);

      await this.tenantCouponsService.releaseReservedCouponForSession({
        sessionId: payment.invoice.sessionId,
        reason: 'PAYMENT_CONFIRM_FAILED',
      });

      throw error;
    }

    const paidAt = this.parseTossApprovedAt(tossApprovedPayment) ?? new Date();

    const result = await this.prisma.$transaction(async (tx) => {
      const updatedPayment = await tx.payment.update({
        where: { id: payment.id },
        data: {
          method: PaymentMethod.TOSS,
          status: PaymentStatus.SUCCESS,
          tossPaymentKey: dto.paymentKey,
          tossOrderId: dto.orderId,
          approvedAt: paidAt,
          rawResponse: {
            source: 'public-toss-confirm',
            paymentKey: dto.paymentKey,
            orderId: dto.orderId,
            amount: dto.amount,
            invoiceId: dto.invoiceId,
            tossApprovedPayment,
          } as any,
        },
      });

      const updatedInvoice = await tx.invoice.update({
        where: { id: payment.invoiceId },
        data: {
          status: InvoiceStatus.PAID,
          paidAmount: payment.invoice!.amount,
          unpaidAmount: 0,
          paidAt,
          metadata: {
            ...((payment.invoice!.metadata as any) ?? {}),
            tossPayment: {
              paymentKey: dto.paymentKey,
              orderId: dto.orderId,
              amount: dto.amount,
              paidAt: paidAt.toISOString(),
              source: 'public-toss-confirm',
            },
            receipt: {
              receiptNo: `TOSS-${Date.now()}`,
              invoiceId: payment.invoiceId,
              invoiceNo: payment.invoice!.invoiceNo,
              paymentId: updatedPayment.id,
              provider: 'TOSS',
              method: 'CARD',
              amount: dto.amount,
              paidAmount: dto.amount,
              paidAt: paidAt.toISOString(),
              approvalNo: dto.paymentKey,
              source: 'public-toss-confirm',
            },
          } as any,
        },
      });

      const updatedSession = await tx.parkingSession.update({
        where: { id: payment.invoice!.sessionId },
        data: {
          status: SessionStatus.PAID,
          paidAmount: payment.invoice!.amount,
          unpaidAmount: 0,
          metadata: {
            ...(((payment.invoice!.session as any)?.metadata as any) ?? {}),
            paymentStatus: 'PAID',
            paymentRequired: false,
            paidAt: paidAt.toISOString(),
            invoiceId: updatedInvoice.id,
            invoiceNo: updatedInvoice.invoiceNo,
            invoiceStatus: updatedInvoice.status,
            invoicePaidAmount: updatedInvoice.paidAmount,
            invoiceUnpaidAmount: updatedInvoice.unpaidAmount,
            tossPayment: {
              paymentKey: dto.paymentKey,
              orderId: dto.orderId,
              amount: dto.amount,
              paidAt: paidAt.toISOString(),
              source: 'public-toss-confirm',
            },
          } as any,
        },
      });

      await tx.domainEvent.create({
        data: {
          eventId: randomUUID(),
          aggregateType: 'Payment',
          aggregateId: updatedPayment.id,
          eventType: 'payment.toss_public_confirmed_dev',
          payload: {
            paymentId: updatedPayment.id,
            invoiceId: updatedInvoice.id,
            sessionId: updatedSession.id,
            paymentKey: dto.paymentKey,
            orderId: dto.orderId,
            amount: dto.amount,
          } as any,
          occurredAt: paidAt,
        },
      });

      return {
        payment: updatedPayment,
        invoice: updatedInvoice,
        session: updatedSession,
      };
    });

    await this.tenantCouponsService.completeReservedCouponForInvoice({
      sessionId: result.session.id,
      invoiceId: result.invoice.id,
    });

    await this.publishPaymentConfirmedRealtime(result);

    await this.ensureReceiptForSuccessfulPayment(result.payment.id);

    return {
      ok: true,
      payment: result.payment,
      invoice: result.invoice,
      session: result.session,
    };
  }

  async tossConfirm(dto: TossConfirmDto) {
    this.assertCloudPaymentAuthority();

    const payment = await this.prisma.payment.findFirst({
      where: {
        OR: [{ tossPaymentKey: dto.paymentKey }, { orderId: dto.orderId }],
      },
      include: {
        invoice: {
          include: {
            session: true,
          },
        },
      },
    });

    if (!payment) {
      throw new NotFoundException('Payment not found for Toss confirm');
    }

    if (payment.amount !== dto.amount) {
      throw new BadRequestException('Toss amount mismatch');
    }

    if (!payment.invoice) {
      throw new BadRequestException('Payment invoice relation is missing');
    }

    if (payment.status === PaymentStatus.SUCCESS) {
      await this.tenantCouponsService.completeReservedCouponForInvoice({
        sessionId: payment.invoice.sessionId,
        invoiceId: payment.invoice.id,
      });
      return {
        ok: true,
        alreadyConfirmed: true,
        payment,
      };
    }

    await this.tenantCouponsService.assertInvoiceCouponReservation({
      sessionId: payment.invoice.sessionId,
      invoiceMetadata: payment.invoice.metadata,
    });

    const result = await this.prisma.$transaction(async (tx) => {
      const updatedPayment = await tx.payment.update({
        where: { id: payment.id },
        data: {
          method: PaymentMethod.TOSS,
          status: PaymentStatus.SUCCESS,
          tossPaymentKey: dto.paymentKey,
          tossOrderId: dto.orderId,
          approvedAt: new Date(),
          rawResponse: {
            source: 'toss-confirm',
            paymentKey: dto.paymentKey,
            orderId: dto.orderId,
            amount: dto.amount,
          } as any,
        },
      });

      const updatedInvoice = await tx.invoice.update({
        where: { id: payment.invoiceId },
        data: {
          status: InvoiceStatus.PAID,
          paidAmount: payment.invoice!.amount,
          unpaidAmount: 0,
          paidAt: new Date(),
        },
      });

      const updatedSession = await tx.parkingSession.update({
        where: { id: payment.invoice!.sessionId },
        data: {
          status: SessionStatus.PAID,
          paidAmount: payment.invoice!.amount,
          unpaidAmount: 0,
        },
      });

      await tx.domainEvent.create({
        data: {
          eventId: randomUUID(),
          aggregateType: 'Payment',
          aggregateId: updatedPayment.id,
          eventType: 'payment.toss_confirmed',
          payload: {
            paymentId: updatedPayment.id,
            invoiceId: updatedInvoice.id,
            sessionId: updatedSession.id,
            paymentKey: dto.paymentKey,
            orderId: dto.orderId,
          } as any,
          occurredAt: new Date(),
        },
      });

      return {
        payment: updatedPayment,
        invoice: updatedInvoice,
        session: updatedSession,
      };
    });

    await this.tenantCouponsService.completeReservedCouponForInvoice({
      sessionId: result.session.id,
      invoiceId: result.invoice.id,
    });

    await this.publishPaymentConfirmedRealtime(result);

    return {
      ok: true,
      payment: result.payment,
      invoice: result.invoice,
      session: result.session,
    };
  }

  async webhook(dto: TossWebhookDto) {
    this.assertCloudPaymentAuthority();

    const data =
      typeof dto.data === 'object' && dto.data !== null
        ? (dto.data as Record<string, unknown>)
        : null;

    const paymentKey =
      typeof dto.paymentKey === 'string'
        ? dto.paymentKey
        : data && typeof data['paymentKey'] === 'string'
          ? String(data['paymentKey'])
          : null;

    const orderId =
      typeof dto.orderId === 'string'
        ? dto.orderId
        : data && typeof data['orderId'] === 'string'
          ? String(data['orderId'])
          : null;

    const status =
      typeof dto.status === 'string'
        ? dto.status
        : data && typeof data['status'] === 'string'
          ? String(data['status'])
          : null;

    const found = paymentKey
      ? await this.prisma.payment.findFirst({
          where: { tossPaymentKey: paymentKey },
          include: {
            invoice: {
              include: {
                session: true,
              },
            },
          },
        })
      : orderId
        ? await this.prisma.payment.findFirst({
            where: { orderId },
            include: {
              invoice: {
                include: {
                  session: true,
                },
              },
            },
          })
        : null;

    if (!found) {
      return {
        ok: true,
        ignored: true,
        reason: 'payment_not_found',
      };
    }

    if (!found.invoice) {
      return {
        ok: true,
        ignored: true,
        reason: 'invoice_not_found',
      };
    }

    if (status === 'DONE') {
      if (found.status !== PaymentStatus.SUCCESS) {
        await this.prisma.$transaction(async (tx) => {
          await tx.payment.update({
            where: { id: found.id },
            data: {
              status: PaymentStatus.SUCCESS,
              approvedAt: new Date(),
              rawResponse: dto as unknown as any,
            },
          });

          await tx.invoice.update({
            where: { id: found.invoiceId },
            data: {
              status: InvoiceStatus.PAID,
              paidAmount: found.invoice!.amount,
              unpaidAmount: 0,
              paidAt: new Date(),
            },
          });

          await tx.parkingSession.update({
            where: { id: found.invoice!.sessionId },
            data: {
              status: SessionStatus.PAID,
              paidAmount: found.invoice!.amount,
              unpaidAmount: 0,
            },
          });
        });

        await this.tenantCouponsService.completeReservedCouponForInvoice({
          sessionId: found.invoice.sessionId,
          invoiceId: found.invoice.id,
        });

        await this.realtimePublisher.publish(WsEvents.PAYMENT_UPDATED, {
          paymentId: found.id,
          invoiceId: found.invoiceId,
          sessionId: found.invoice.sessionId,
          status: PaymentStatus.SUCCESS,
        });

        await this.realtimePublisher.publish(WsEvents.INVOICE_UPDATED, {
          invoiceId: found.invoiceId,
          sessionId: found.invoice.sessionId,
          status: InvoiceStatus.PAID,
        });
      }

      return { ok: true, status: 'DONE' };
    }

    if (status === 'CANCELED' || status === 'PARTIAL_CANCELED') {
      await this.prisma.payment.update({
        where: { id: found.id },
        data: {
          status: PaymentStatus.CANCELLED,
          cancelledAt: new Date(),
          rawResponse: dto as unknown as any,
        },
      });

      await this.tenantCouponsService.releaseReservedCouponForSession({
        sessionId: found.invoice.sessionId,
        reason: 'PAYMENT_CANCELLED',
      });

      await this.realtimePublisher.publish(WsEvents.PAYMENT_FAILED, {
        paymentId: found.id,
        invoiceId: found.invoiceId,
        status: PaymentStatus.CANCELLED,
      });

      return { ok: true, status: 'CANCELED' };
    }

    return {
      ok: true,
      ignored: true,
      status,
    };
  }

  async cancelPublicTossPayment(
    invoiceId: string,
    input: {
      code?: string | null;
      orderId?: string | null;
      reason?: string | null;
    } = {},
  ) {
    this.assertCloudPaymentAuthority();

    const invoice = await this.prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: {
        session: true,
        payments: true,
      },
    });

    if (!invoice) {
      throw new NotFoundException('Invoice not found');
    }

    if (invoice.status === InvoiceStatus.PAID || invoice.unpaidAmount <= 0) {
      return {
        ok: true,
        alreadyPaid: true,
        couponReleased: false,
      };
    }

    const now = new Date();
    const pendingPaymentIds = invoice.payments
      .filter((payment) => payment.status === PaymentStatus.PENDING)
      .filter(
        (payment) => !input.orderId || payment.orderId === input.orderId,
      )
      .map((payment) => payment.id);

    if (pendingPaymentIds.length > 0) {
      await this.prisma.payment.updateMany({
        where: {
          id: { in: pendingPaymentIds },
          status: PaymentStatus.PENDING,
        },
        data: {
          status: PaymentStatus.CANCELLED,
          cancelledAt: now,
          failureCode: input.code ?? 'TOSS_CHECKOUT_CANCELLED',
          failureMessage: input.reason ?? 'Toss checkout was not completed',
        },
      });
    }

    const releasedCoupon =
      await this.tenantCouponsService.releaseReservedCouponForSession({
        sessionId: invoice.sessionId,
        reason: 'TOSS_CHECKOUT_CANCELLED',
      });

    return {
      ok: true,
      alreadyPaid: false,
      cancelledPaymentCount: pendingPaymentIds.length,
      couponReleased: Boolean(releasedCoupon),
      couponId: releasedCoupon?.id ?? null,
    };
  }

  async createPendingPayment(invoiceId: string) {
    this.assertCloudPaymentAuthority();

    const invoice = await this.prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: {
        session: true,
        payments: true,
      },
    });

    if (!invoice) {
      throw new NotFoundException('Invoice not found');
    }

    if (invoice.unpaidAmount <= 0) {
      throw new BadRequestException('Invoice already fully paid');
    }

    try {
      await this.tenantCouponsService.assertInvoiceCouponReservation({
        sessionId: invoice.sessionId,
        invoiceMetadata: invoice.metadata,
      });
    } catch (error) {
      await this.prisma.payment.updateMany({
        where: {
          invoiceId,
          status: PaymentStatus.PENDING,
        },
        data: {
          status: PaymentStatus.CANCELLED,
          cancelledAt: new Date(),
          failureCode: 'COUPON_RESERVATION_INVALID',
          failureMessage: 'Coupon reservation expired before checkout',
        },
      });
      throw error;
    }

    const pendingPayments = invoice.payments.filter(
      (payment) => payment.status === PaymentStatus.PENDING,
    );
    const existingPending = pendingPayments.find(
      (payment) => payment.amount === invoice.unpaidAmount,
    );
    const stalePendingIds = pendingPayments
      .filter((payment) => payment.id !== existingPending?.id)
      .map((payment) => payment.id);

    if (stalePendingIds.length > 0) {
      await this.prisma.payment.updateMany({
        where: {
          id: { in: stalePendingIds },
          status: PaymentStatus.PENDING,
        },
        data: {
          status: PaymentStatus.CANCELLED,
          cancelledAt: new Date(),
          failureCode: 'PAYMENT_AMOUNT_STALE',
          failureMessage: 'Invoice amount changed before checkout',
        },
      });
    }

    if (existingPending) {
      return existingPending;
    }

    const orderId = `ORDER-${Date.now()}`;

    const payment = await this.prisma.payment.create({
      data: {
        orderId,
        invoiceId,
        amount: invoice.unpaidAmount,
        method: PaymentMethod.TOSS,
        status: PaymentStatus.PENDING,
      },
    });

    await this.realtimePublisher.publish(WsEvents.PAYMENT_CREATED, {
      paymentId: payment.id,
      invoiceId,
      orderId: payment.orderId,
      amount: payment.amount,
      status: payment.status,
    });

    return payment;
  }

  async refund(paymentId: string, reason?: string) {
    this.assertCloudPaymentAuthority();

    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
      include: {
        invoice: {
          include: {
            session: true,
          },
        },
      },
    });

    if (!payment) {
      throw new NotFoundException('Payment not found');
    }

    if (!payment.invoice) {
      throw new BadRequestException('Invoice relation not found');
    }

    if (payment.status !== PaymentStatus.SUCCESS) {
      throw new BadRequestException('Only SUCCESS payment can be refunded');
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const refundedPayment = await tx.payment.update({
        where: { id: paymentId },
        data: {
          status: PaymentStatus.REFUNDED,
          cancelledAt: new Date(),
          failureMessage: reason ?? null,
        },
      });

      const updatedInvoice = await tx.invoice.update({
        where: { id: payment.invoiceId },
        data: {
          status: InvoiceStatus.ISSUED,
          paidAmount: 0,
          unpaidAmount: payment.invoice.amount,
          paidAt: null,
        },
      });

      const updatedSession = await tx.parkingSession.update({
        where: { id: payment.invoice.sessionId },
        data: {
          status: SessionStatus.CLOSED,
          paidAmount: 0,
          unpaidAmount: payment.invoice.amount,
        },
      });

      return {
        payment: refundedPayment,
        invoice: updatedInvoice,
        session: updatedSession,
      };
    });

    await this.realtimePublisher.publish(WsEvents.PAYMENT_FAILED, {
      paymentId: result.payment.id,
      invoiceId: result.invoice.id,
      sessionId: result.session.id,
      status: result.payment.status,
      reason: reason ?? null,
    });

    await this.realtimePublisher.publish(WsEvents.INVOICE_UPDATED, {
      invoiceId: result.invoice.id,
      sessionId: result.session.id,
      status: result.invoice.status,
      paidAmount: result.invoice.paidAmount,
      unpaidAmount: result.invoice.unpaidAmount,
    });

    return result;
  }


  private createAutoReceiptNo(now = new Date()) {
    const ymd = now.toISOString().slice(0, 10).replace(/-/g, '');
    const hms = now.toISOString().slice(11, 19).replace(/:/g, '');
    return `RCPT-${ymd}${hms}-${randomUUID().slice(0, 8).toUpperCase()}`;
  }

  private resolveReceiptTaxAmounts(invoice: any, paymentAmount: number) {
    const totalAmount = Math.max(
      0,
      Math.round(
        Number(invoice?.finalAmount ?? invoice?.amount ?? paymentAmount ?? 0),
      ),
    );

    const taxType = String(invoice?.taxType ?? 'VAT_INCLUDED');

    if (taxType === 'TAX_EXEMPT') {
      return {
        taxType,
        supplyAmount: Number(invoice?.supplyAmount ?? totalAmount),
        taxAmount: 0,
        totalAmount,
      };
    }

    const fallbackSupplyAmount = Math.round((totalAmount * 10) / 11);
    const supplyAmount = Number(invoice?.supplyAmount ?? fallbackSupplyAmount);
    const taxAmount = Number(
      invoice?.vatAmount ?? Math.max(0, totalAmount - supplyAmount),
    );

    return {
      taxType: 'VAT_INCLUDED',
      supplyAmount,
      taxAmount,
      totalAmount,
    };
  }

  private async ensureReceiptForSuccessfulPayment(paymentId: string) {
    const payment = await this.prisma.payment.findUnique({
      where: {
        id: paymentId,
      },
      include: {
        invoice: true,
        receipt: true,
      },
    });

    if (!payment) {
      return null;
    }

    if (payment.receipt) {
      return payment.receipt;
    }

    if (payment.status !== 'SUCCESS') {
      return null;
    }

    const invoice = payment.invoice as any;
    const tax = this.resolveReceiptTaxAmounts(invoice, payment.amount);
    const issuedAt = payment.approvedAt ?? new Date();

    return this.prisma.receipt.create({
      data: {
        receiptNo: this.createAutoReceiptNo(issuedAt),
        paymentId: payment.id,
        invoiceId: payment.invoiceId,
        sessionId: invoice?.sessionId ?? null,
        status: 'ISSUED',
        supplyAmount: tax.supplyAmount,
        taxAmount: tax.taxAmount,
        totalAmount: tax.totalAmount,
        issuedAt,
        metadata: {
          source: 'payments.ensureReceiptForSuccessfulPayment',
          taxType: tax.taxType,
          paymentMethod: payment.method,
          tossPaymentKey: payment.tossPaymentKey,
          tossOrderId: payment.tossOrderId,
        },
      },
    });
  }

  async issueReceipt(
    paymentId: string,
    issuedByUserId: string,
    dto?: { ownerName?: string; ownerPhone?: string },
  ) {
    this.assertCloudPaymentAuthority();

    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
      include: {
        invoice: {
          include: {
            session: {
              include: {
                user: {
                  select: {
                    id: true,
                    name: true,
                    email: true,
                    phone: true,
                  },
                },
              },
            },
          },
        },
        receipt: true,
      },
    });

    if (!payment) {
      throw new NotFoundException('Payment not found');
    }

    if (payment.status !== PaymentStatus.SUCCESS) {
      throw new BadRequestException(
        'Only SUCCESS payment can issue receipt',
      );
    }

    if (payment.receipt) {
      return payment.receipt;
    }

    const ownerUser = payment.invoice?.session?.user ?? null;

    return this.prisma.receipt.create({
      data: {
        receiptNo: `RCPT-${Date.now()}`,
        paymentId: payment.id,
        invoiceId: payment.invoiceId,
        sessionId: payment.invoice?.sessionId ?? null,
        issuedByUserId,
        ownerUserId: ownerUser?.id ?? null,
        ownerName: dto?.ownerName ?? ownerUser?.name ?? null,
        ownerPhone: dto?.ownerPhone ?? ownerUser?.phone ?? null,
        supplyAmount: payment.amount,
        taxAmount: 0,
        totalAmount: payment.amount,
        metadata: {
          orderId: payment.orderId,
          tossPaymentKey: payment.tossPaymentKey,
        } as any,
      },
      include: {
        payment: true,
        invoice: true,
        session: true,
      },
    });
  }

  async claimMyReceipt(userId: string, paymentId: string) {
    this.assertCloudPaymentAuthority();

    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
      include: {
        invoice: {
          include: {
            session: {
              include: {
                user: {
                  select: {
                    id: true,
                    name: true,
                    email: true,
                    phone: true,
                  },
                },
              },
            },
          },
        },
        receipt: true,
      },
    });

    if (!payment) {
      throw new NotFoundException('Payment not found');
    }

    const ownerUserId = payment.invoice?.session?.userId;

    if (ownerUserId !== userId) {
      throw new BadRequestException('Receipt claim denied');
    }

    if (payment.receipt) {
      return payment.receipt;
    }

    const ownerUser = payment.invoice?.session?.user ?? null;

    return this.prisma.receipt.create({
      data: {
        receiptNo: `RCPT-${Date.now()}`,
        paymentId: payment.id,
        invoiceId: payment.invoiceId,
        sessionId: payment.invoice?.sessionId ?? null,
        ownerUserId: userId,
        ownerName: ownerUser?.name ?? null,
        ownerPhone: null,
        supplyAmount: payment.amount,
        taxAmount: 0,
        totalAmount: payment.amount,
        metadata: {
          orderId: payment.orderId,
          tossPaymentKey: payment.tossPaymentKey,
          claimedBy: userId,
        } as any,
      },
      include: {
        payment: true,
        invoice: true,
        session: true,
      },
    });
  }

  async getMyReceipts(userId: string) {
    return this.prisma.receipt.findMany({
      where: {
        OR: [{ ownerUserId: userId }, { session: { userId } }],
      },
      include: {
        payment: true,
        invoice: true,
        session: true,
      },
      orderBy: {
        issuedAt: 'desc',
      },
    });
  }

  async getReceiptById(receiptId: string, userId?: string) {
    const receipt = await this.prisma.receipt.findUnique({
      where: { id: receiptId },
      include: {
        payment: true,
        invoice: true,
        session: true,
        ownerUser: true,
        issuedByUser: true,
      },
    });

    if (!receipt) {
      throw new NotFoundException('Receipt not found');
    }

    if (userId != null) {
      const allowed =
        receipt.ownerUserId === userId ||
        receipt.session?.userId === userId;

      if (!allowed) {
        throw new BadRequestException('Receipt access denied');
      }
    }

    return receipt;
  }

  async kakaoReady(dto: {
    invoiceId?: string;
    amount: number;
    orderId?: string;
    orderName?: string;
    userId?: string;
  }) {
    this.assertCloudPaymentAuthority();

    return {
      provider: 'KAKAO_PAY',
      status: 'READY',
      invoiceId: dto.invoiceId ?? null,
      amount: dto.amount,
      orderId: dto.orderId ?? `KAKAO-${Date.now()}`,
      orderName: dto.orderName ?? 'Parking Fee',
      nextRedirectMobileUrl: null,
      nextRedirectPcUrl: null,
    };
  }

  async kakaoApprove(dto: {
    invoiceId?: string;
    paymentId?: string;
    pgToken?: string;
    userId?: string;
  }) {
    this.assertCloudPaymentAuthority();

    return {
      provider: 'KAKAO_PAY',
      status: 'APPROVED',
      invoiceId: dto.invoiceId ?? null,
      paymentId: dto.paymentId ?? `KAKAO-PAY-${Date.now()}`,
      approvedAt: new Date(),
    };
  }

  private assertCloudPaymentAuthority() {
    const paymentAuthority = (
      process.env.PAYMENT_AUTHORITY ?? 'cloud'
    ).toLowerCase();

    if (
      isEdgeRuntimeProfile() ||
      paymentAuthority !== 'cloud'
    ) {
      throw new ForbiddenException(
        'Payment operations are only available in cloud mode',
      );
    }
  }

  private async publishPaymentConfirmedRealtime(result: {
    payment: {
      id: string;
      orderId: string;
      amount: number;
      status: PaymentStatus;
    };
    invoice: {
      id: string;
      paidAmount: number;
      unpaidAmount: number;
      status: InvoiceStatus;
    };
    session: {
      id: string;
      status: SessionStatus;
    };
  }) {
    await this.realtimePublisher.publish(WsEvents.PAYMENT_CREATED, {
      paymentId: result.payment.id,
      invoiceId: result.invoice.id,
      orderId: result.payment.orderId,
      amount: result.payment.amount,
      status: result.payment.status,
    });

    await this.realtimePublisher.publish(WsEvents.PAYMENT_UPDATED, {
      paymentId: result.payment.id,
      invoiceId: result.invoice.id,
      sessionId: result.session.id,
      status: result.payment.status,
      paidAmount: result.invoice.paidAmount,
      unpaidAmount: result.invoice.unpaidAmount,
    });

    await this.realtimePublisher.publish(WsEvents.INVOICE_UPDATED, {
      invoiceId: result.invoice.id,
      sessionId: result.session.id,
      status: result.invoice.status,
      paidAmount: result.invoice.paidAmount,
      unpaidAmount: result.invoice.unpaidAmount,
    });

    await this.realtimePublisher.publish(WsEvents.SESSION_CLOSED, {
      sessionId: result.session.id,
      status: result.session.status,
      invoiceId: result.invoice.id,
    });
  }

  private resolveMockPaymentAmount(input: {
    dtoAmount?: number;
    invoiceAmount: number;
    invoiceUnpaidAmount: number;
    sessionUnpaidAmount: number;
  }) {
    const fallbackAmount =
      input.invoiceUnpaidAmount > 0
        ? input.invoiceUnpaidAmount
        : input.invoiceAmount > 0
          ? input.invoiceAmount
          : input.sessionUnpaidAmount > 0
            ? input.sessionUnpaidAmount
            : 0;

    if (
      input.dtoAmount != null &&
      Number.isFinite(input.dtoAmount) &&
      input.dtoAmount > 0
    ) {
      const requestedAmount = Math.floor(input.dtoAmount);

      if (input.invoiceUnpaidAmount > 0) {
        return Math.min(requestedAmount, input.invoiceUnpaidAmount);
      }

      return requestedAmount;
    }

    return fallbackAmount;
  }

  private getPaidExitGraceMinutes() {
    const raw = process.env.PAID_EXIT_GRACE_MINUTES;
    const parsed = raw ? Number(raw) : 10;

    if (!Number.isFinite(parsed) || parsed <= 0) {
      return 10;
    }

    return Math.floor(parsed);
  }

  private asRecord(value: unknown): Record<string, any> {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return {};
    }

    return value as Record<string, any>;
  }
}