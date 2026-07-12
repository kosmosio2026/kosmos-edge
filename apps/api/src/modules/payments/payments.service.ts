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

@Injectable()
export class PaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly realtimePublisher: RealtimePublisherService,
    private readonly invoicesService: InvoicesService,
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
      return {
        ok: true,
        alreadyConfirmed: true,
        userId,
        payment,
      };
    }

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

    await this.publishPaymentConfirmedRealtime(result);

    return {
      ok: true,
      userId,
      payment: result.payment,
      invoice: result.invoice,
      session: result.session,
    };
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
      return {
        ok: true,
        alreadyConfirmed: true,
        payment,
        invoice: payment.invoice,
      };
    }

    /**
     * TODO: Toss 실제 승인 API 연동 위치
     *
     * 현재 publicConfirmTossPayment()는 개발 중 테스트를 위해
     * Toss 서버에 실제 승인 요청을 보내지 않고 내부 DB만 결제 완료 처리한다.
     *
     * Toss 테스트/운영 키가 준비되면 아래 순서로 이 위치에 승인 로직을 추가한다.
     *
     * 1. 서버 환경변수에 TOSS_SECRET_KEY 추가
     *    - 절대 NEXT_PUBLIC_* 로 노출하지 않는다.
     *    - apps/api/.env 또는 배포 secret manager에만 저장한다.
     *
     * 2. Toss 승인 API 호출
     *    - POST https://api.tosspayments.com/v1/payments/confirm
     *    - Basic Auth username: TOSS_SECRET_KEY
     *    - Basic Auth password: 빈 문자열
     *    - body:
     *      {
     *        paymentKey: dto.paymentKey,
     *        orderId: dto.orderId,
     *        amount: dto.amount
     *      }
     *
     * 3. Toss 응답 검증
     *    - 응답 status가 DONE인지 확인
     *    - 응답 orderId가 dto.orderId와 같은지 확인
     *    - 응답 totalAmount 또는 amount가 dto.amount와 같은지 확인
     *    - DB의 payment.amount와 dto.amount가 이미 같은지 위에서 확인했으므로
     *      Toss 응답까지 다시 맞아야 최종 승인 처리한다.
     *
     * 4. 실패 시 처리
     *    - Payment.status = FAILED
     *    - failureCode / failureMessage 저장
     *    - rawResponse에 Toss 실패 응답 저장
     *    - Invoice / ParkingSession은 PAID로 바꾸지 않는다.
     *
     * 5. 성공 시 처리
     *    - 아래 transaction 로직을 그대로 사용하되,
     *      rawResponse.source를 public-toss-confirm 으로 변경하고
     *      rawResponse에 실제 Toss 응답 전체 또는 필요한 필드를 저장한다.
     *    - receipt.approvalNo에는 Toss 승인번호 또는 paymentKey를 저장한다.
     *
     * 보안상 중요한 점:
     * - public-confirm endpoint는 공개 청구서 링크에서 호출되므로
     *   반드시 invoiceId + orderId + amount + paymentKey를 모두 검증해야 한다.
     * - 클라이언트가 보낸 amount만 믿으면 안 되고,
     *   DB payment.amount와 Toss 응답 금액을 모두 비교해야 한다.
     */
    const paidAt = new Date();

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
            source: 'public-toss-confirm-dev',
            paymentKey: dto.paymentKey,
            orderId: dto.orderId,
            amount: dto.amount,
            invoiceId: dto.invoiceId,
            note: 'Toss secret key not configured yet. Real Toss approval call will be added later.',
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
              source: 'public-toss-confirm-dev',
            },
            receipt: {
              receiptNo: `TOSS-DEV-${Date.now()}`,
              invoiceId: payment.invoiceId,
              invoiceNo: payment.invoice!.invoiceNo,
              paymentId: updatedPayment.id,
              provider: 'TOSS',
              method: 'CARD',
              amount: dto.amount,
              paidAmount: dto.amount,
              paidAt: paidAt.toISOString(),
              approvalNo: dto.paymentKey,
              source: 'public-toss-confirm-dev',
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
              source: 'public-toss-confirm-dev',
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

    await this.publishPaymentConfirmedRealtime(result);

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
      return {
        ok: true,
        alreadyConfirmed: true,
        payment,
      };
    }

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

    const existingPending = invoice.payments.find(
      (payment) => payment.status === PaymentStatus.PENDING,
    );

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