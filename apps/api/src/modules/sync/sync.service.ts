import { BadRequestException, Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { InvoicesService } from '../invoices/invoices.service';

type EdgePushEvent = {
  eventId?: string;
  eventType: string;
  aggregateType?: string;
  aggregateId?: string;
  occurredAt?: string;
  payload: Record<string, unknown>;
};

type SyncedUnpaidExitPayload = {
  edgeNodeId?: string;
  sessionId?: string;
  sessionNo?: string;
  parkingSpaceId?: string;
  sensorDeviceId?: string;
  devEui?: string;
  occurredAt?: string;
  totalMinutes?: number;
  isRegistered?: boolean;
  paymentRequired?: boolean;
  paymentStatus?: string;
  exitedUnpaid?: boolean;
  paymentReason?: string;
  additionalFeeRequired?: boolean;
  invoiceCreated?: boolean;
  invoiceCreationSkippedForEdge?: boolean;
  syncRequired?: boolean;
};

type EdgeApplyInput = {
  cursor?: string;
  outboxId?: string;
  eventType?: string;
  payload?: Record<string, unknown>;
  message?: {
    cursor?: string;
    outboxId?: string;
    eventType?: string;
    payload?: Record<string, unknown>;
  };
};

type ResolvedCloudMessage = {
  cursor: string | null;
  outboxId: string | null;
  eventType: string;
  payload: Record<string, unknown>;
};

@Injectable()
export class SyncService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly invoicesService: InvoicesService,
  ) {}

  async pushFromEdge(edgeNodeId: string, events: EdgePushEvent[]) {
    if (!Array.isArray(events)) {
      throw new BadRequestException('events must be an array');
    }

    const results = [];

    for (const event of events) {
      if (!event.eventType || !event.payload) {
        results.push({
          ok: false,
          eventId: event.eventId ?? null,
          error: 'INVALID_EVENT',
        });
        continue;
      }

      const messageId =
        event.eventId ??
        `${edgeNodeId}:${event.eventType}:${Date.now()}:${Math.random()
          .toString(36)
          .slice(2)}`;

      const inboxPayload = {
        edgeNodeId,
        occurredAt: event.occurredAt ?? null,
        ...(event.payload as Record<string, unknown>),
      };

      const inbox = await this.prisma.syncInbox.upsert({
        where: {
          messageId,
        },
        update: {
          source: `EDGE:${edgeNodeId}`,
          eventType: event.eventType,
          aggregateType: event.aggregateType,
          aggregateId: event.aggregateId,
          payload: inboxPayload as any,
        },
        create: {
          messageId,
          source: `EDGE:${edgeNodeId}`,
          eventType: event.eventType,
          aggregateType: event.aggregateType,
          aggregateId: event.aggregateId,
          payload: inboxPayload as any,
          status: 'RECEIVED',
        },
      });

      const processingResult = await this.processEdgeEvent({
        edgeNodeId,
        event,
        inboxId: inbox.id,
        messageId: inbox.messageId,
        payload: inboxPayload,
      });

      results.push({
        ok: true,
        eventId: event.eventId ?? null,
        messageId: inbox.messageId,
        inboxId: inbox.id,
        processed: processingResult.processed,
        action: processingResult.action,
        invoice: processingResult.invoice,
        error: processingResult.error,
      });
    }

    await this.prisma.edgeNode.update({
      where: {
        id: edgeNodeId,
      },
      data: {
        lastSeenAt: new Date(),
        lastSyncAt: new Date(),
      },
    });

    return {
      ok: true,
      accepted: results.filter((r) => r.ok).length,
      rejected: results.filter((r) => !r.ok).length,
      processed: results.filter((r) => r.processed).length,
      results,
    };
  }

  async pullForEdge(edgeNodeId: string, limit?: number) {
    const take =
      limit && Number.isFinite(limit) && limit > 0
        ? Math.min(Math.floor(limit), 100)
        : 50;

    const messages = await this.prisma.syncOutbox.findMany({
      where: {
        destination: `EDGE:${edgeNodeId}`,
        status: 'PENDING' as any,
        OR: [
          {
            nextRetryAt: null,
          },
          {
            nextRetryAt: {
              lte: new Date(),
            },
          },
        ],
      },
      include: {
        domainEvent: true,
      },
      orderBy: {
        createdAt: 'asc',
      },
      take,
    });

    await this.prisma.edgeNode.update({
      where: {
        id: edgeNodeId,
      },
      data: {
        lastSeenAt: new Date(),
        lastSyncAt: new Date(),
      },
    });

    return {
      ok: true,
      edgeNodeId,
      count: messages.length,
      messages: messages.map((message) => ({
        cursor: message.id,
        outboxId: message.id,
        domainEventId: message.domainEventId,
        eventId: message.domainEvent.eventId,
        eventType: message.domainEvent.eventType,
        aggregateType: message.domainEvent.aggregateType,
        aggregateId: message.domainEvent.aggregateId,
        payload: message.domainEvent.payload,
        occurredAt: message.domainEvent.occurredAt,
        createdAt: message.createdAt,
      })),
    };
  }

  async applyCloudMessageOnEdge(edgeNodeId: string, input: EdgeApplyInput) {
    const message = await this.resolveCloudMessageForApply(edgeNodeId, input);

    switch (message.eventType) {
      case 'INVOICE_CREATED_FROM_CLOUD':
      case 'INVOICE_ALREADY_EXISTS_FROM_CLOUD':
        return this.applyInvoiceCreatedFromCloud(edgeNodeId, message);

      case 'INVOICE_PAID_FROM_CLOUD':
      case 'INVOICE_PARTIALLY_PAID_FROM_CLOUD':
        return this.applyInvoicePaymentFromCloud(edgeNodeId, message);

      default:
        return {
          ok: true,
          applied: false,
          action: 'IGNORED_EVENT_TYPE',
          edgeNodeId,
          cursor: message.cursor,
          outboxId: message.outboxId,
          eventType: message.eventType,
        };
    }
  }

  async ackFromEdge(edgeNodeId: string, cursor: string) {
    if (!cursor) {
      throw new BadRequestException('cursor is required');
    }

    const outbox = await this.prisma.syncOutbox.findFirst({
      where: {
        id: cursor,
        destination: `EDGE:${edgeNodeId}`,
      },
    });

    if (outbox) {
      await this.prisma.syncOutbox.update({
        where: {
          id: outbox.id,
        },
        data: {
          status: 'ACKED' as any,
          sentAt: outbox.sentAt ?? new Date(),
          ackedAt: new Date(),
        },
      });
    }

    const syncCursor = await this.prisma.syncCursor.upsert({
      where: {
        edgeNodeId_direction_stream: {
          edgeNodeId,
          direction: 'CLOUD_TO_EDGE',
          stream: 'default',
        },
      },
      update: {
        lastMessageId: cursor,
        lastSyncedAt: new Date(),
      },
      create: {
        edgeNodeId,
        direction: 'CLOUD_TO_EDGE',
        stream: 'default',
        lastMessageId: cursor,
        lastSequence: BigInt(0),
        lastSyncedAt: new Date(),
      },
    });

    await this.prisma.edgeNode.update({
      where: {
        id: edgeNodeId,
      },
      data: {
        lastSeenAt: new Date(),
        lastSyncAt: new Date(),
      },
    });

    return {
      ok: true,
      cursor: syncCursor.lastMessageId,
      stream: syncCursor.stream,
      lastSequence: syncCursor.lastSequence.toString(),
      lastSyncedAt: syncCursor.lastSyncedAt,
      outboxAcked: outbox != null,
    };
  }

  private async resolveCloudMessageForApply(
    edgeNodeId: string,
    input: EdgeApplyInput,
  ): Promise<ResolvedCloudMessage> {
    const nested = input?.message ?? {};

    const cursor =
      input?.cursor ??
      input?.outboxId ??
      nested.cursor ??
      nested.outboxId ??
      null;

    const eventType = input?.eventType ?? nested.eventType ?? null;
    const payload = input?.payload ?? nested.payload ?? null;

    if (cursor && (!eventType || !payload)) {
      const outbox = await this.prisma.syncOutbox.findFirst({
        where: {
          id: cursor,
          destination: `EDGE:${edgeNodeId}`,
        },
        include: {
          domainEvent: true,
        },
      });

      if (!outbox) {
        throw new BadRequestException(`SyncOutbox not found: ${cursor}`);
      }

      return {
        cursor: outbox.id,
        outboxId: outbox.id,
        eventType: outbox.domainEvent.eventType,
        payload: this.asRecord(outbox.domainEvent.payload),
      };
    }

    if (!eventType || !payload || typeof payload !== 'object') {
      throw new BadRequestException(
        'apply requires cursor or eventType + payload',
      );
    }

    return {
      cursor,
      outboxId: cursor,
      eventType,
      payload,
    };
  }

  private async applyInvoiceCreatedFromCloud(
    edgeNodeId: string,
    message: ResolvedCloudMessage,
  ) {
    const payload = message.payload;
    const session = await this.findLocalSessionFromCloudPayload(payload);

    if (!session) {
      return {
        ok: false,
        applied: false,
        action: 'LOCAL_SESSION_NOT_FOUND',
        edgeNodeId,
        cursor: message.cursor,
        outboxId: message.outboxId,
        eventType: message.eventType,
        edgeSessionId: this.stringValue(payload.edgeSessionId),
        edgeSessionNo: this.stringValue(payload.edgeSessionNo),
      };
    }

    const metadata = this.asRecord(session.metadata);
    const invoicePaidAmount = this.numberValue(payload.invoicePaidAmount);
    const invoiceUnpaidAmount = this.numberValue(payload.invoiceUnpaidAmount);

    const paymentStatus =
      this.stringValue(payload.paymentStatus) ??
      this.resolvePaymentStatusFromInvoice({
        paidAmount: invoicePaidAmount ?? 0,
        unpaidAmount: invoiceUnpaidAmount ?? 0,
      });

    const updatedSession = await this.prisma.parkingSession.update({
      where: {
        id: session.id,
      },
      data: {
        paidAmount: invoicePaidAmount ?? session.paidAmount,
        unpaidAmount: invoiceUnpaidAmount ?? session.unpaidAmount,
        metadata: {
          ...metadata,
          cloudInvoiceSyncedAt: new Date().toISOString(),
          cloudInvoiceSyncEventType: message.eventType,
          invoiceId:
            this.stringValue(payload.invoiceId) ??
            metadata.invoiceId ??
            null,
          invoiceNo:
            this.stringValue(payload.invoiceNo) ??
            metadata.invoiceNo ??
            null,
          invoiceStatus:
            this.stringValue(payload.invoiceStatus) ??
            metadata.invoiceStatus ??
            null,
          invoiceAmount:
            this.numberValue(payload.invoiceAmount) ??
            metadata.invoiceAmount ??
            null,
          invoicePaidAmount:
            invoicePaidAmount ?? metadata.invoicePaidAmount ?? null,
          invoiceUnpaidAmount:
            invoiceUnpaidAmount ?? metadata.invoiceUnpaidAmount ?? null,
          paymentStatus,
          paymentRequired: (invoiceUnpaidAmount ?? 0) > 0,
          invoiceCreatedAtEdge: false,
          invoiceSyncRequired: false,
          cloudSessionId:
            this.stringValue(payload.cloudSessionId) ??
            metadata.cloudSessionId ??
            null,
          cloudSessionNo:
            this.stringValue(payload.cloudSessionNo) ??
            metadata.cloudSessionNo ??
            null,
          cloudToEdgeCursor: message.cursor,
        } as any,
        events: {
          create: {
            type: 'CLOUD_INVOICE_SYNC_APPLIED',
            source: 'CLOUD_SYNC',
            payload: {
              edgeNodeId,
              cursor: message.cursor,
              outboxId: message.outboxId,
              eventType: message.eventType,
              invoiceId: this.stringValue(payload.invoiceId),
              invoiceNo: this.stringValue(payload.invoiceNo),
              invoiceStatus: this.stringValue(payload.invoiceStatus),
              invoiceAmount: this.numberValue(payload.invoiceAmount),
              invoicePaidAmount,
              invoiceUnpaidAmount,
              paymentStatus,
            } as any,
          },
        },
      },
    });

    return {
      ok: true,
      applied: true,
      action: 'CLOUD_INVOICE_APPLIED_TO_EDGE_SESSION',
      edgeNodeId,
      cursor: message.cursor,
      outboxId: message.outboxId,
      eventType: message.eventType,
      sessionId: updatedSession.id,
      sessionNo: updatedSession.sessionNo,
      invoiceId: this.stringValue(payload.invoiceId),
      invoiceNo: this.stringValue(payload.invoiceNo),
      paymentStatus,
    };
  }

  private async applyInvoicePaymentFromCloud(
    edgeNodeId: string,
    message: ResolvedCloudMessage,
  ) {
    const payload = message.payload;
    const session = await this.findLocalSessionFromCloudPayload(payload);

    if (!session) {
      return {
        ok: false,
        applied: false,
        action: 'LOCAL_SESSION_NOT_FOUND',
        edgeNodeId,
        cursor: message.cursor,
        outboxId: message.outboxId,
        eventType: message.eventType,
        edgeSessionId: this.stringValue(payload.edgeSessionId),
        edgeSessionNo: this.stringValue(payload.edgeSessionNo),
      };
    }

    const metadata = this.asRecord(session.metadata);
    const invoicePaidAmount = this.numberValue(payload.invoicePaidAmount);
    const invoiceUnpaidAmount = this.numberValue(payload.invoiceUnpaidAmount);

    const paymentStatus =
      this.stringValue(payload.paymentStatus) ??
      this.resolvePaymentStatusFromInvoice({
        paidAmount: invoicePaidAmount ?? 0,
        unpaidAmount: invoiceUnpaidAmount ?? 0,
      });

    const isPaid =
      paymentStatus === 'PAID' || (invoiceUnpaidAmount ?? 0) <= 0;

    const updatedSession = await this.prisma.parkingSession.update({
      where: {
        id: session.id,
      },
      data: {
        status: isPaid ? ('PAID' as any) : (session.status as any),
        paidAmount: invoicePaidAmount ?? session.paidAmount,
        unpaidAmount: invoiceUnpaidAmount ?? session.unpaidAmount,
        metadata: {
          ...metadata,
          cloudInvoicePaymentSyncedAt: new Date().toISOString(),
          cloudInvoiceSyncEventType: message.eventType,
          invoiceId:
            this.stringValue(payload.invoiceId) ??
            metadata.invoiceId ??
            null,
          invoiceNo:
            this.stringValue(payload.invoiceNo) ??
            metadata.invoiceNo ??
            null,
          invoiceStatus:
            this.stringValue(payload.invoiceStatus) ??
            metadata.invoiceStatus ??
            null,
          invoiceAmount:
            this.numberValue(payload.invoiceAmount) ??
            metadata.invoiceAmount ??
            null,
          invoicePaidAmount:
            invoicePaidAmount ?? metadata.invoicePaidAmount ?? null,
          invoiceUnpaidAmount:
            invoiceUnpaidAmount ?? metadata.invoiceUnpaidAmount ?? null,
          paymentStatus,
          paymentRequired: !isPaid,
          exitedUnpaid: !isPaid,
          additionalFeeRequired: !isPaid,
          collectionStatus: isPaid ? 'PAID' : 'PARTIALLY_PAID',
          paidViaCloud: true,
          paidViaCloudAt:
            this.stringValue(payload.paidAt) ?? new Date().toISOString(),
          cloudSessionId:
            this.stringValue(payload.cloudSessionId) ??
            metadata.cloudSessionId ??
            null,
          cloudSessionNo:
            this.stringValue(payload.cloudSessionNo) ??
            metadata.cloudSessionNo ??
            null,
          transactionId:
            this.stringValue(payload.transactionId) ??
            metadata.transactionId ??
            null,
          transactionNo:
            this.stringValue(payload.transactionNo) ??
            metadata.transactionNo ??
            null,
          receipt:
            this.asRecordOrNull(payload.receipt) ??
            metadata.receipt ??
            null,
          cloudToEdgeCursor: message.cursor,
        } as any,
        events: {
          create: {
            type: isPaid
              ? 'CLOUD_INVOICE_PAID_SYNC_APPLIED'
              : 'CLOUD_INVOICE_PARTIALLY_PAID_SYNC_APPLIED',
            source: 'CLOUD_SYNC',
            payload: {
              edgeNodeId,
              cursor: message.cursor,
              outboxId: message.outboxId,
              eventType: message.eventType,
              invoiceId: this.stringValue(payload.invoiceId),
              invoiceNo: this.stringValue(payload.invoiceNo),
              invoiceStatus: this.stringValue(payload.invoiceStatus),
              invoiceAmount: this.numberValue(payload.invoiceAmount),
              invoicePaidAmount,
              invoiceUnpaidAmount,
              paymentStatus,
              paidAt: this.stringValue(payload.paidAt),
              transactionId: this.stringValue(payload.transactionId),
              transactionNo: this.stringValue(payload.transactionNo),
              receipt: this.asRecordOrNull(payload.receipt),
            } as any,
          },
        },
      },
    });

    return {
      ok: true,
      applied: true,
      action: isPaid
        ? 'CLOUD_INVOICE_PAYMENT_APPLIED_TO_EDGE_SESSION'
        : 'CLOUD_PARTIAL_PAYMENT_APPLIED_TO_EDGE_SESSION',
      edgeNodeId,
      cursor: message.cursor,
      outboxId: message.outboxId,
      eventType: message.eventType,
      sessionId: updatedSession.id,
      sessionNo: updatedSession.sessionNo,
      invoiceId: this.stringValue(payload.invoiceId),
      invoiceNo: this.stringValue(payload.invoiceNo),
      paymentStatus,
      invoicePaidAmount,
      invoiceUnpaidAmount,
    };
  }

  private async findLocalSessionFromCloudPayload(
    payload: Record<string, unknown>,
  ) {
    const edgeSessionId = this.stringValue(payload.edgeSessionId);
    const edgeSessionNo = this.stringValue(payload.edgeSessionNo);
    const cloudSessionId = this.stringValue(payload.cloudSessionId);
    const cloudSessionNo = this.stringValue(payload.cloudSessionNo);

    if (edgeSessionId) {
      const byEdgeId = await this.prisma.parkingSession.findUnique({
        where: {
          id: edgeSessionId,
        },
      });

      if (byEdgeId) {
        return byEdgeId;
      }
    }

    if (edgeSessionNo) {
      const byEdgeSessionNo = await this.prisma.parkingSession.findFirst({
        where: {
          sessionNo: edgeSessionNo,
        },
      });

      if (byEdgeSessionNo) {
        return byEdgeSessionNo;
      }
    }

    if (cloudSessionId) {
      const byCloudId = await this.prisma.parkingSession.findUnique({
        where: {
          id: cloudSessionId,
        },
      });

      if (byCloudId) {
        return byCloudId;
      }
    }

    if (cloudSessionNo) {
      const byCloudSessionNo = await this.prisma.parkingSession.findFirst({
        where: {
          sessionNo: cloudSessionNo,
        },
      });

      if (byCloudSessionNo) {
        return byCloudSessionNo;
      }
    }

    return null;
  }

  private async processEdgeEvent(input: {
    edgeNodeId: string;
    event: EdgePushEvent;
    inboxId: string;
    messageId: string;
    payload: Record<string, unknown>;
  }): Promise<{
    processed: boolean;
    action: string;
    invoice: Record<string, unknown> | null;
    error: string | null;
  }> {
    if (!this.isCloudMode()) {
      return {
        processed: false,
        action: 'SKIPPED_NOT_CLOUD_MODE',
        invoice: null,
        error: null,
      };
    }

    if (
      input.event.eventType !==
      'PARKING_SESSION_EXITED_UNPAID_EDGE_SYNC_REQUIRED'
    ) {
      return {
        processed: false,
        action: 'IGNORED_EVENT_TYPE',
        invoice: null,
        error: null,
      };
    }

    try {
      const result = await this.createCloudInvoiceForEdgeUnpaidExit({
        edgeNodeId: input.edgeNodeId,
        event: input.event,
        payload: input.payload,
      });

      await this.markInboxProcessed({
        messageId: input.messageId,
        payload: input.payload,
        result,
      });

      return {
        processed: true,
        action: result.action,
        invoice: result.invoice,
        error: null,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      await this.markInboxFailed({
        messageId: input.messageId,
        payload: input.payload,
        error: message,
      });

      return {
        processed: false,
        action: 'PROCESSING_FAILED',
        invoice: null,
        error: message,
      };
    }
  }

  private async createCloudInvoiceForEdgeUnpaidExit(input: {
    edgeNodeId: string;
    event: EdgePushEvent;
    payload: Record<string, unknown>;
  }) {
    const payload = this.normalizeUnpaidExitPayload(input.payload);

    if (!payload.sessionId && !payload.sessionNo) {
      throw new BadRequestException(
        'Edge unpaid exit event requires sessionId or sessionNo',
      );
    }

    if (!payload.parkingSpaceId) {
      throw new BadRequestException(
        'Edge unpaid exit event requires parkingSpaceId',
      );
    }

    const occurredAt = this.resolveOccurredAt(
      payload.occurredAt ?? input.event.occurredAt,
    );

    const session = await this.ensureCloudParkingSessionFromEdge({
      edgeNodeId: input.edgeNodeId,
      payload,
      occurredAt,
    });

    const existingInvoice = await this.invoicesService.findBySessionId(
      session.id,
    );

    if (existingInvoice && existingInvoice.unpaidAmount > 0) {
      await this.createCloudToEdgeOutboxMessage({
        edgeNodeId: input.edgeNodeId,
        eventType: 'INVOICE_ALREADY_EXISTS_FROM_CLOUD',
        aggregateType: 'Invoice',
        aggregateId: existingInvoice.id,
        payload: {
          edgeNodeId: input.edgeNodeId,
          edgeSessionId: payload.sessionId ?? null,
          edgeSessionNo: payload.sessionNo ?? null,
          cloudSessionId: session.id,
          cloudSessionNo: session.sessionNo,
          invoiceId: existingInvoice.id,
          invoiceNo: existingInvoice.invoiceNo,
          invoiceStatus: existingInvoice.status,
          invoiceAmount: existingInvoice.amount,
          invoicePaidAmount: existingInvoice.paidAmount,
          invoiceUnpaidAmount: existingInvoice.unpaidAmount,
          paymentStatus: this.resolvePaymentStatusFromInvoice({
            paidAmount: existingInvoice.paidAmount,
            unpaidAmount: existingInvoice.unpaidAmount,
          }),
          occurredAt: occurredAt.toISOString(),
        },
      });

      return {
        action: 'INVOICE_ALREADY_EXISTS',
        sessionId: session.id,
        sessionNo: session.sessionNo,
        invoice: {
          invoiceId: existingInvoice.id,
          invoiceNo: existingInvoice.invoiceNo,
          invoiceStatus: existingInvoice.status,
          invoiceAmount: existingInvoice.amount,
          invoicePaidAmount: existingInvoice.paidAmount,
          invoiceUnpaidAmount: existingInvoice.unpaidAmount,
        },
      };
    }

    const { invoice, calculation } =
      await this.invoicesService.ensureInvoiceForSession({
        sessionId: session.id,
        now: occurredAt,
        forceRecalculate: true,
      });

    const sessionMetadata = this.asRecord(session.metadata);

    await this.prisma.parkingSession.update({
      where: {
        id: session.id,
      },
      data: {
        paidAmount: invoice.paidAmount,
        unpaidAmount: invoice.unpaidAmount,
        metadata: {
          ...sessionMetadata,
          source: 'EDGE_SYNC',
          edgeNodeId: input.edgeNodeId,
          syncedFromEdge: true,
          syncedFromEdgeAt: new Date().toISOString(),
          invoiceId: invoice.id,
          invoiceNo: invoice.invoiceNo,
          invoiceStatus: invoice.status,
          invoiceAmount: invoice.amount,
          invoicePaidAmount: invoice.paidAmount,
          invoiceUnpaidAmount: invoice.unpaidAmount,
          invoiceCreatedByCloudSync: true,
          invoiceCreatedAtEdge: false,
          invoiceSyncRequired: false,
          feeCalculation: calculation,
        } as any,
        events: {
          create: {
            type: 'UNPAID_INVOICE_CREATED_BY_CLOUD_SYNC',
            source: 'EDGE_SYNC',
            payload: {
              edgeNodeId: input.edgeNodeId,
              sessionId: session.id,
              sessionNo: session.sessionNo,
              invoiceId: invoice.id,
              invoiceNo: invoice.invoiceNo,
              invoiceStatus: invoice.status,
              invoiceAmount: invoice.amount,
              invoicePaidAmount: invoice.paidAmount,
              invoiceUnpaidAmount: invoice.unpaidAmount,
              occurredAt: occurredAt.toISOString(),
            } as any,
          },
        },
      },
    });

    await this.createCloudToEdgeOutboxMessage({
      edgeNodeId: input.edgeNodeId,
      eventType: 'INVOICE_CREATED_FROM_CLOUD',
      aggregateType: 'Invoice',
      aggregateId: invoice.id,
      payload: {
        edgeNodeId: input.edgeNodeId,
        edgeSessionId: payload.sessionId ?? null,
        edgeSessionNo: payload.sessionNo ?? null,
        cloudSessionId: session.id,
        cloudSessionNo: session.sessionNo,
        invoiceId: invoice.id,
        invoiceNo: invoice.invoiceNo,
        invoiceStatus: invoice.status,
        invoiceAmount: invoice.amount,
        invoicePaidAmount: invoice.paidAmount,
        invoiceUnpaidAmount: invoice.unpaidAmount,
        paymentStatus: this.resolvePaymentStatusFromInvoice({
          paidAmount: invoice.paidAmount,
          unpaidAmount: invoice.unpaidAmount,
        }),
        occurredAt: occurredAt.toISOString(),
      },
    });

    await this.prisma.domainEvent.create({
      data: {
        eventId: randomUUID(),
        aggregateType: 'Invoice',
        aggregateId: invoice.id,
        eventType: 'INVOICE_CREATED_FROM_EDGE_UNPAID_EXIT',
        payload: {
          edgeNodeId: input.edgeNodeId,
          edgeEventType: input.event.eventType,
          edgeAggregateId: input.event.aggregateId ?? null,
          sessionId: session.id,
          sessionNo: session.sessionNo,
          parkingSpaceId: payload.parkingSpaceId,
          invoiceId: invoice.id,
          invoiceNo: invoice.invoiceNo,
          invoiceStatus: invoice.status,
          invoiceAmount: invoice.amount,
          invoicePaidAmount: invoice.paidAmount,
          invoiceUnpaidAmount: invoice.unpaidAmount,
          occurredAt: occurredAt.toISOString(),
        } as any,
        occurredAt,
      },
    });

    return {
      action: 'INVOICE_CREATED_FROM_EDGE_UNPAID_EXIT',
      sessionId: session.id,
      sessionNo: session.sessionNo,
      invoice: {
        invoiceId: invoice.id,
        invoiceNo: invoice.invoiceNo,
        invoiceStatus: invoice.status,
        invoiceAmount: invoice.amount,
        invoicePaidAmount: invoice.paidAmount,
        invoiceUnpaidAmount: invoice.unpaidAmount,
      },
    };
  }

  private async ensureCloudParkingSessionFromEdge(input: {
    edgeNodeId: string;
    payload: SyncedUnpaidExitPayload;
    occurredAt: Date;
  }) {
    const payload = input.payload;

    const existingById = payload.sessionId
      ? await this.prisma.parkingSession.findUnique({
          where: {
            id: payload.sessionId,
          },
        })
      : null;

    if (existingById) {
      return this.updateCloudParkingSessionFromEdge({
        sessionId: existingById.id,
        edgeNodeId: input.edgeNodeId,
        payload,
        occurredAt: input.occurredAt,
      });
    }

    const existingBySessionNo = payload.sessionNo
      ? await this.prisma.parkingSession.findFirst({
          where: {
            sessionNo: payload.sessionNo,
          },
        })
      : null;

    if (existingBySessionNo) {
      return this.updateCloudParkingSessionFromEdge({
        sessionId: existingBySessionNo.id,
        edgeNodeId: input.edgeNodeId,
        payload,
        occurredAt: input.occurredAt,
      });
    }

    return this.createCloudParkingSessionFromEdge({
      edgeNodeId: input.edgeNodeId,
      payload,
      occurredAt: input.occurredAt,
    });
  }

  private async updateCloudParkingSessionFromEdge(input: {
    sessionId: string;
    edgeNodeId: string;
    payload: SyncedUnpaidExitPayload;
    occurredAt: Date;
  }) {
    const existing = await this.prisma.parkingSession.findUnique({
      where: {
        id: input.sessionId,
      },
    });

    if (!existing) {
      throw new BadRequestException(
        `Cannot update missing parking session: ${input.sessionId}`,
      );
    }

    const metadata = this.asRecord(existing.metadata);
    const entryTime = this.resolveEntryTime({
      occurredAt: input.occurredAt,
      totalMinutes: input.payload.totalMinutes,
      fallback: existing.entryTime ?? existing.createdAt,
    });

    return this.prisma.parkingSession.update({
      where: {
        id: input.sessionId,
      },
      data: {
        parkingSpaceId: input.payload.parkingSpaceId ?? existing.parkingSpaceId,
        status: 'CLOSED' as any,
        entryTime,
        exitTime: input.occurredAt,
        totalMinutes: input.payload.totalMinutes ?? existing.totalMinutes,
        isRegistered: input.payload.isRegistered ?? existing.isRegistered,
        metadata: {
          ...metadata,
          source: 'EDGE_SYNC',
          edgeNodeId: input.edgeNodeId,
          edgeSessionId: input.payload.sessionId ?? existing.id,
          edgeSessionNo: input.payload.sessionNo ?? existing.sessionNo,
          syncedFromEdge: true,
          syncedFromEdgeAt: new Date().toISOString(),
          paymentRequired: input.payload.paymentRequired ?? true,
          paymentStatus: input.payload.paymentStatus ?? 'UNPAID',
          exitedUnpaid: input.payload.exitedUnpaid ?? true,
          paymentReason: input.payload.paymentReason ?? 'EXITED_UNPAID',
          additionalFeeRequired:
            input.payload.additionalFeeRequired ?? false,
          invoiceCreatedAtEdge: false,
          invoiceSyncRequired: true,
          sensorDeviceId: input.payload.sensorDeviceId ?? null,
          devEui: input.payload.devEui ?? null,
        } as any,
        events: {
          create: {
            type: 'EDGE_UNPAID_EXIT_SYNCED',
            source: 'EDGE_SYNC',
            payload: {
              edgeNodeId: input.edgeNodeId,
              edgeSessionId: input.payload.sessionId ?? null,
              edgeSessionNo: input.payload.sessionNo ?? null,
              occurredAt: input.occurredAt.toISOString(),
              totalMinutes: input.payload.totalMinutes ?? null,
            } as any,
          },
        },
      },
    });
  }

  private async createCloudParkingSessionFromEdge(input: {
    edgeNodeId: string;
    payload: SyncedUnpaidExitPayload;
    occurredAt: Date;
  }) {
    if (!input.payload.parkingSpaceId) {
      throw new BadRequestException('parkingSpaceId is required');
    }

    const parkingSpace = await this.prisma.parkingSpace.findUnique({
      where: {
        id: input.payload.parkingSpaceId,
      },
    });

    if (!parkingSpace) {
      throw new BadRequestException(
        `Cloud parking space not found: ${input.payload.parkingSpaceId}`,
      );
    }

    const entryTime = this.resolveEntryTime({
      occurredAt: input.occurredAt,
      totalMinutes: input.payload.totalMinutes,
      fallback: input.occurredAt,
    });

    const createData: Record<string, any> = {
      sessionNo:
        input.payload.sessionNo ??
        this.createCloudSyncedSessionNo(input.occurredAt),
      parkingSpaceId: input.payload.parkingSpaceId,
      sessionType: 'HOURLY',
      status: 'CLOSED',
      entryTime,
      exitTime: input.occurredAt,
      totalMinutes: input.payload.totalMinutes ?? 0,
      isRegistered: input.payload.isRegistered ?? true,
      paidAmount: 0,
      unpaidAmount: 0,
      metadata: {
        source: 'EDGE_SYNC',
        edgeNodeId: input.edgeNodeId,
        edgeSessionId: input.payload.sessionId ?? null,
        edgeSessionNo: input.payload.sessionNo ?? null,
        syncedFromEdge: true,
        syncedFromEdgeAt: new Date().toISOString(),
        paymentRequired: input.payload.paymentRequired ?? true,
        paymentStatus: input.payload.paymentStatus ?? 'UNPAID',
        exitedUnpaid: input.payload.exitedUnpaid ?? true,
        paymentReason: input.payload.paymentReason ?? 'EXITED_UNPAID',
        additionalFeeRequired:
          input.payload.additionalFeeRequired ?? false,
        invoiceCreatedAtEdge: false,
        invoiceSyncRequired: true,
        sensorDeviceId: input.payload.sensorDeviceId ?? null,
        devEui: input.payload.devEui ?? null,
      },
      events: {
        create: {
          type: 'EDGE_UNPAID_EXIT_SESSION_CREATED_IN_CLOUD',
          source: 'EDGE_SYNC',
          payload: {
            edgeNodeId: input.edgeNodeId,
            edgeSessionId: input.payload.sessionId ?? null,
            edgeSessionNo: input.payload.sessionNo ?? null,
            parkingSpaceId: input.payload.parkingSpaceId,
            occurredAt: input.occurredAt.toISOString(),
            totalMinutes: input.payload.totalMinutes ?? null,
          } as any,
        },
      },
    };

    if (input.payload.sessionId) {
      createData.id = input.payload.sessionId;
    }

    return this.prisma.parkingSession.create({
      data: createData as any,
    });
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

  private async markInboxProcessed(input: {
    messageId: string;
    payload: Record<string, unknown>;
    result: {
      action: string;
      sessionId: string;
      sessionNo: string;
      invoice: Record<string, unknown> | null;
    };
  }) {
    return this.prisma.syncInbox.update({
      where: {
        messageId: input.messageId,
      },
      data: {
        status: 'PROCESSED',
        processedAt: new Date(),
        payload: {
          ...input.payload,
          cloudProcessing: {
            status: 'PROCESSED',
            action: input.result.action,
            sessionId: input.result.sessionId,
            sessionNo: input.result.sessionNo,
            invoice: input.result.invoice,
            processedAt: new Date().toISOString(),
          },
        } as any,
      },
    });
  }

  private async markInboxFailed(input: {
    messageId: string;
    payload: Record<string, unknown>;
    error: string;
  }) {
    return this.prisma.syncInbox.update({
      where: {
        messageId: input.messageId,
      },
      data: {
        status: 'FAILED',
        failedAt: new Date(),
        error: input.error,
        payload: {
          ...input.payload,
          cloudProcessing: {
            status: 'FAILED',
            error: input.error,
            processedAt: new Date().toISOString(),
          },
        } as any,
      },
    });
  }

  private normalizeUnpaidExitPayload(
    value: Record<string, unknown>,
  ): SyncedUnpaidExitPayload {
    return {
      edgeNodeId:
        typeof value.edgeNodeId === 'string'
          ? value.edgeNodeId
          : undefined,
      sessionId:
        typeof value.sessionId === 'string'
          ? value.sessionId
          : undefined,
      sessionNo:
        typeof value.sessionNo === 'string'
          ? value.sessionNo
          : undefined,
      parkingSpaceId:
        typeof value.parkingSpaceId === 'string'
          ? value.parkingSpaceId
          : undefined,
      sensorDeviceId:
        typeof value.sensorDeviceId === 'string'
          ? value.sensorDeviceId
          : undefined,
      devEui:
        typeof value.devEui === 'string' ? value.devEui : undefined,
      occurredAt:
        typeof value.occurredAt === 'string'
          ? value.occurredAt
          : undefined,
      totalMinutes:
        typeof value.totalMinutes === 'number' &&
        Number.isFinite(value.totalMinutes)
          ? Math.max(0, Math.floor(value.totalMinutes))
          : undefined,
      isRegistered:
        typeof value.isRegistered === 'boolean'
          ? value.isRegistered
          : undefined,
      paymentRequired:
        typeof value.paymentRequired === 'boolean'
          ? value.paymentRequired
          : undefined,
      paymentStatus:
        typeof value.paymentStatus === 'string'
          ? value.paymentStatus
          : undefined,
      exitedUnpaid:
        typeof value.exitedUnpaid === 'boolean'
          ? value.exitedUnpaid
          : undefined,
      paymentReason:
        typeof value.paymentReason === 'string'
          ? value.paymentReason
          : undefined,
      additionalFeeRequired:
        typeof value.additionalFeeRequired === 'boolean'
          ? value.additionalFeeRequired
          : undefined,
      invoiceCreated:
        typeof value.invoiceCreated === 'boolean'
          ? value.invoiceCreated
          : undefined,
      invoiceCreationSkippedForEdge:
        typeof value.invoiceCreationSkippedForEdge === 'boolean'
          ? value.invoiceCreationSkippedForEdge
          : undefined,
      syncRequired:
        typeof value.syncRequired === 'boolean'
          ? value.syncRequired
          : undefined,
    };
  }

  private resolvePaymentStatusFromInvoice(input: {
    paidAmount: number;
    unpaidAmount: number;
  }) {
    if (input.unpaidAmount <= 0) return 'PAID';
    if (input.paidAmount > 0) return 'PARTIALLY_PAID';
    return 'UNPAID';
  }

  private resolveOccurredAt(value?: string | null) {
    if (!value) {
      return new Date();
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return new Date();
    }

    return date;
  }

  private resolveEntryTime(input: {
    occurredAt: Date;
    totalMinutes?: number;
    fallback: Date;
  }) {
    if (
      input.totalMinutes != null &&
      Number.isFinite(input.totalMinutes) &&
      input.totalMinutes > 0
    ) {
      return new Date(input.occurredAt.getTime() - input.totalMinutes * 60000);
    }

    return input.fallback;
  }

  private isCloudMode() {
    return (process.env.APP_MODE ?? 'cloud').toLowerCase() === 'cloud';
  }

  private createCloudSyncedSessionNo(date: Date) {
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    const random = Math.random().toString(36).slice(2, 10).toUpperCase();

    return `SYNC-${yyyy}${mm}${dd}-${random}`;
  }

  private stringValue(value: unknown) {
    return typeof value === 'string' && value.length > 0 ? value : null;
  }

  private numberValue(value: unknown) {
    return typeof value === 'number' && Number.isFinite(value)
      ? value
      : null;
  }

  private asRecord(value: unknown): Record<string, any> {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return {};
    }

    return value as Record<string, any>;
  }

  private asRecordOrNull(value: unknown): Record<string, any> | null {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return null;
    }

    return value as Record<string, any>;
  }
}