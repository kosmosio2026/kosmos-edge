import { isConnectedEdgeProfile } from '../config/app-mode';
type EdgeParkingSessionEventType =
  | 'PARKING_SESSION_ENTERED_FROM_EDGE'
  | 'PARKING_SESSION_EXITED_FROM_EDGE';

type EdgeParkingSessionSyncInput = {
  eventType: EdgeParkingSessionEventType;
  session: any;
  invoice?: any;
  calculation?: any;
  source: string;
  sensorDeviceId?: string | null;
  devEui?: string | null;
};

function asRecord(
  value: unknown,
): Record<string, any> {
  if (
    !value ||
    typeof value !== 'object' ||
    Array.isArray(value)
  ) {
    return {};
  }

  return value as Record<string, any>;
}

function isoDate(
  value: unknown,
): string | null {
  if (value instanceof Date) {
    return value.toISOString();
  }

  if (
    typeof value === 'string' &&
    value.trim()
  ) {
    const parsed = new Date(value);

    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toISOString();
    }
  }

  return null;
}

export async function enqueueEdgeParkingSessionSync(
  prisma: any,
  input: EdgeParkingSessionSyncInput,
) {
  if (!isConnectedEdgeProfile()) {
    return {
      created: false,
      reason: 'NOT_CONNECTED_EDGE_PROFILE',
    };
  }

  const session = input.session;

  if (
    !session?.id ||
    !session?.sessionNo ||
    !session?.parkingSpaceId
  ) {
    return {
      created: false,
      reason: 'MISSING_SESSION_SCOPE',
    };
  }

  const parkingSpace =
    await prisma.parkingSpace.findUnique({
      where: {
        id: session.parkingSpaceId,
      },
      include: {
        section: {
          include: {
            parkingLot: true,
          },
        },
      },
    });

  if (!parkingSpace?.section?.parkingLot) {
    return {
      created: false,
      reason: 'MISSING_PARKING_LOT_SCOPE',
    };
  }

  const metadata =
    asRecord(session.metadata);

  const occurredAtText =
    input.eventType ===
    'PARKING_SESSION_ENTERED_FROM_EDGE'
      ? isoDate(session.entryTime)
      : isoDate(session.exitTime);

  const occurredAt =
    occurredAtText
      ? new Date(occurredAtText)
      : new Date();

  const eventId =
    input.eventType ===
    'PARKING_SESSION_ENTERED_FROM_EDGE'
      ? `EDGE-SESSION-ENTRY:${session.id}`
      : [
          'EDGE-SESSION-EXIT',
          session.id,
          occurredAt.toISOString(),
        ].join(':');

  const existing =
    await prisma.domainEvent.findUnique({
      where: {
        eventId,
      },
      include: {
        outboxes: true,
      },
    });

  if (existing) {
    const existingOutbox =
      existing.outboxes.find(
        (item: any) =>
          item.destination === 'CLOUD',
      );

    if (!existingOutbox) {
      const outbox =
        await prisma.syncOutbox.create({
          data: {
            domainEventId: existing.id,
            destination: 'CLOUD',
            status: 'PENDING',
          },
        });

      return {
        created: false,
        repaired: true,
        eventId,
        domainEventId: existing.id,
        outboxId: outbox.id,
      };
    }

    return {
      created: false,
      duplicate: true,
      eventId,
      domainEventId: existing.id,
      outboxId: existingOutbox.id,
    };
  }

  const invoice =
    input.invoice ?? null;

  const payload = {
    edgeNodeId:
      process.env.EDGE_NODE_ID ??
      null,

    sessionId:
      session.id,
    sessionNo:
      session.sessionNo,
    sessionStatus:
      session.status,

    parkingLotId:
      parkingSpace.section
        .parkingLot.id,
    parkingLotCode:
      parkingSpace.section
        .parkingLot.code,

    parkingSectionId:
      parkingSpace.section.id,
    parkingSectionCode:
      parkingSpace.section.code,

    parkingSpaceId:
      parkingSpace.id,
    parkingSpaceCode:
      parkingSpace.code,

    sensorDeviceId:
      input.sensorDeviceId ??
      metadata.sensorDeviceId ??
      null,

    devEui:
      input.devEui ??
      metadata.devEui ??
      null,

    plateNumber:
      session.plateNumber ??
      null,

    edgeUserId:
      session.userId ??
      null,

    edgeVehicleId:
      session.vehicleId ??
      null,

    entrySource:
      session.entrySource ??
      'SENSOR',

    exitSource:
      session.exitSource ??
      (
        input.eventType ===
        'PARKING_SESSION_EXITED_FROM_EDGE'
          ? 'SENSOR'
          : null
      ),

    entryTime:
      isoDate(session.entryTime),

    exitTime:
      isoDate(session.exitTime),

    billingClosedAt:
      isoDate(
        session.billingClosedAt,
      ),

    totalMinutes:
      session.totalMinutes ??
      null,

    isRegistered:
      session.isRegistered ??
      false,

    registrationStatus:
      session.registrationStatus ??
      metadata.registrationStatus ??
      null,

    amount:
      session.amount ??
      invoice?.amount ??
      null,

    paidAmount:
      session.paidAmount ??
      invoice?.paidAmount ??
      null,

    unpaidAmount:
      session.unpaidAmount ??
      invoice?.unpaidAmount ??
      null,

    invoiceId:
      invoice?.id ??
      metadata.invoiceId ??
      null,

    invoiceNo:
      invoice?.invoiceNo ??
      metadata.invoiceNo ??
      null,

    invoiceStatus:
      invoice?.status ??
      metadata.invoiceStatus ??
      null,

    paymentRequired:
      typeof metadata.paymentRequired ===
      'boolean'
        ? metadata.paymentRequired
        : Number(
            session.unpaidAmount ??
            invoice?.unpaidAmount ??
            0,
          ) > 0,

    metadata,
    feeCalculation:
      input.calculation ??
      metadata.feeCalculation ??
      null,

    source:
      input.source,

    occurredAt:
      occurredAt.toISOString(),
  };

  const created =
    await prisma.domainEvent.create({
      data: {
        eventId,
        aggregateType:
          'ParkingSession',
        aggregateId:
          session.id,
        eventType:
          input.eventType,
        eventVersion: 1,
        payload,
        occurredAt,
        outboxes: {
          create: {
            destination: 'CLOUD',
            status: 'PENDING',
          },
        },
      },
      include: {
        outboxes: true,
      },
    });

  return {
    created: true,
    eventId,
    domainEventId: created.id,
    outboxId:
      created.outboxes[0]?.id ??
      null,
  };
}

type EdgeUnpaidExitSyncInput = {
  session: any;
  invoice: any;
  calculation?: any;
  additionalFeeAmount?: number | null;
  additionalFeeReason?: string | null;
  source: string;
  sensorDeviceId?: string | null;
  devEui?: string | null;
};

export async function enqueueEdgeUnpaidExitSync(
  prisma: any,
  input: EdgeUnpaidExitSyncInput,
) {
  if (!isConnectedEdgeProfile()) {
    return {
      created: false,
      reason: 'NOT_CONNECTED_EDGE_PROFILE',
    };
  }

  const session = input.session;
  const invoice = input.invoice;

  const unpaidAmount = Math.max(
    0,
    Number(
      session?.unpaidAmount ??
      invoice?.unpaidAmount ??
      0,
    ),
  );

  if (unpaidAmount <= 0) {
    return {
      created: false,
      reason: 'NO_UNPAID_AMOUNT',
    };
  }

  if (
    !session?.id ||
    !session?.sessionNo ||
    !session?.parkingSpaceId
  ) {
    return {
      created: false,
      reason: 'MISSING_SESSION_SCOPE',
    };
  }

  const parkingSpace =
    await prisma.parkingSpace.findUnique({
      where: {
        id: session.parkingSpaceId,
      },
      include: {
        section: {
          include: {
            parkingLot: true,
          },
        },
      },
    });

  if (!parkingSpace?.section?.parkingLot) {
    return {
      created: false,
      reason: 'MISSING_PARKING_LOT_SCOPE',
    };
  }

  const metadata =
    asRecord(session.metadata);

  const occurredAtText =
    isoDate(session.exitTime) ??
    new Date().toISOString();

  const occurredAt =
    new Date(occurredAtText);

  const eventId = [
    'EDGE-SESSION-UNPAID-EXIT',
    session.id,
    occurredAt.toISOString(),
  ].join(':');

  const existing =
    await prisma.domainEvent.findUnique({
      where: {
        eventId,
      },
      include: {
        outboxes: true,
      },
    });

  if (existing) {
    const existingOutbox =
      existing.outboxes.find(
        (item: any) =>
          item.destination === 'CLOUD',
      );

    if (!existingOutbox) {
      const outbox =
        await prisma.syncOutbox.create({
          data: {
            domainEventId: existing.id,
            destination: 'CLOUD',
            status: 'PENDING',
          },
        });

      return {
        created: false,
        repaired: true,
        eventId,
        domainEventId: existing.id,
        outboxId: outbox.id,
      };
    }

    return {
      created: false,
      duplicate: true,
      eventId,
      domainEventId: existing.id,
      outboxId: existingOutbox.id,
    };
  }

  const paidAmount = Math.max(
    0,
    Number(
      session.paidAmount ??
      invoice?.paidAmount ??
      0,
    ),
  );

  const amount = Math.max(
    0,
    Number(
      session.amount ??
      invoice?.amount ??
      unpaidAmount + paidAmount,
    ),
  );

  const paymentStatus =
    unpaidAmount <= 0
      ? 'PAID'
      : paidAmount > 0
        ? 'PARTIALLY_PAID'
        : 'UNPAID';

  const payload = {
    appMode: 'edge',

    edgeNodeId:
      process.env.EDGE_NODE_ID ??
      null,

    sessionId:
      session.id,

    sessionNo:
      session.sessionNo,

    parkingLotId:
      parkingSpace.section
        .parkingLot.id,

    parkingLotCode:
      parkingSpace.section
        .parkingLot.code,

    parkingSectionId:
      parkingSpace.section.id,

    parkingSectionCode:
      parkingSpace.section.code,

    parkingSpaceId:
      parkingSpace.id,

    parkingSpaceCode:
      parkingSpace.code,

    sensorDeviceId:
      input.sensorDeviceId ??
      metadata.sensorDeviceId ??
      null,

    devEui:
      input.devEui ??
      metadata.devEui ??
      null,

    occurredAt:
      occurredAt.toISOString(),

    entryTime:
      isoDate(session.entryTime),

    exitTime:
      isoDate(session.exitTime),

    totalMinutes:
      session.totalMinutes ??
      null,

    isRegistered:
      session.isRegistered ??
      false,

    registrationStatus:
      session.registrationStatus ??
      metadata.registrationStatus ??
      null,

    paymentRequired: true,
    paymentStatus,
    exitedUnpaid: true,

    paymentReason:
      input.additionalFeeReason ??
      metadata.additionalFeeReason ??
      'UNPAID_BEFORE_EXIT',

    additionalFeeRequired:
      unpaidAmount > 0,

    additionalFeeAmount:
      input.additionalFeeAmount ??
      unpaidAmount,

    amount,
    paidAmount,
    unpaidAmount,

    invoice: null,
    invoiceCreated: false,

    invoiceCreatedAtEdge:
      Boolean(invoice?.id),

    invoiceCreationSkippedForEdge:
      false,

    edgeInvoice: invoice
      ? {
          id:
            invoice.id ?? null,
          invoiceNo:
            invoice.invoiceNo ?? null,
          status:
            invoice.status ?? null,
          amount:
            invoice.amount ?? amount,
          paidAmount:
            invoice.paidAmount ??
            paidAmount,
          unpaidAmount:
            invoice.unpaidAmount ??
            unpaidAmount,
        }
      : null,

    feeCalculation:
      input.calculation ??
      metadata.feeCalculation ??
      null,

    syncRequired: true,
    source: input.source,
  };

  const createRecords =
    async (tx: any) => {
        await tx.parkingSession.update({
          where: {
            id: session.id,
          },
          data: {
            exitSource:
              session.exitSource ??
              'SENSOR',

            metadata: {
              ...metadata,
              invoiceSyncRequired: true,

              edgeInvoiceId:
                invoice?.id ??
                metadata.edgeInvoiceId ??
                null,
              edgeInvoiceNo:
                invoice?.invoiceNo ??
                metadata.edgeInvoiceNo ??
                null,
              edgeInvoiceStatus:
                invoice?.status ??
                metadata.edgeInvoiceStatus ??
                null,
              edgeInvoiceAmount:
                invoice?.amount ??
                metadata.edgeInvoiceAmount ??
                null,
              edgeInvoicePaidAmount:
                invoice?.paidAmount ??
                metadata.edgeInvoicePaidAmount ??
                null,
              edgeInvoiceUnpaidAmount:
                invoice?.unpaidAmount ??
                metadata.edgeInvoiceUnpaidAmount ??
                null,

              invoiceCreatedAtEdge:
                Boolean(
                  invoice?.id ??
                  metadata.edgeInvoiceId,
                ),

              cloudInvoiceSyncedAt: null,
              cloudInvoiceSyncEventType:
                'PARKING_SESSION_EXITED_UNPAID_EDGE_SYNC_REQUIRED',
              unpaidExitSyncRequestedAt:
                new Date().toISOString(),
            },
          },
        });

        await tx.parkingSessionEvent.create({
          data: {
            sessionId:
              session.id,
            type:
              'UNPAID_INVOICE_CREATION_REQUESTED_FROM_CLOUD',
            source:
              input.source,
            payload: {
              edgeNodeId:
                process.env.EDGE_NODE_ID ??
                null,
              unpaidAmount,
              eventId,
              occurredAt:
                occurredAt.toISOString(),
            },
          },
        });

        return tx.domainEvent.create({
          data: {
            eventId,
            aggregateType:
              'ParkingSession',
            aggregateId:
              session.id,
            eventType:
              'PARKING_SESSION_EXITED_UNPAID_EDGE_SYNC_REQUIRED',
            eventVersion: 1,
            payload,
            occurredAt,
            outboxes: {
              create: {
                destination: 'CLOUD',
                status: 'PENDING',
              },
            },
          },
          include: {
            outboxes: true,
          },
        });
    };

  const created =
    typeof prisma.$transaction === 'function'
      ? await prisma.$transaction(
          createRecords,
        )
      : await createRecords(prisma);

  return {
    created: true,
    eventId,
    domainEventId:
      created.id,
    outboxId:
      created.outboxes[0]?.id ??
      null,
  };
}
