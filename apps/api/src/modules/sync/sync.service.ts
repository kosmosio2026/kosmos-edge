import { isCloudProfile } from '../../common/config/app-mode';
import { BadRequestException, Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { InvoicesService } from '../invoices/invoices.service';
import { ensureActiveParkingLotQr } from '../../common/parking-lot-qr/parking-lot-qr.helper';

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

      if (inbox.status === 'PROCESSED') {
        results.push({
          ok: true,
          eventId: event.eventId ?? null,
          messageId: inbox.messageId,
          inboxId: inbox.id,
          processed: true,
          action: 'ALREADY_PROCESSED',
          invoice: null,
          error: null,
        });

        continue;
      }

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

      case 'MANAGER_LOT_ACCESS_APPROVED_FROM_CLOUD':
      case 'MANAGER_LOT_ACCESS_REJECTED_FROM_CLOUD':
        return this.applyManagerLotAccessReviewFromCloud(
          edgeNodeId,
          message,
        );

      case 'PARKING_LOT_OPERATION_SNAPSHOT_FROM_CLOUD':
        return this.applyParkingLotOperationSnapshotFromCloud(
          edgeNodeId,
          message,
        );

      case 'PARKING_LOT_CONFIGURATION_UPDATED_FROM_CLOUD':
        return this.applyParkingLotConfigurationFromCloud(
          edgeNodeId,
          message,
        );

      case 'DISPLAY_BOARD_CONFIGURATION_UPDATED_FROM_CLOUD':
        return this.applyDisplayBoardConfigurationFromCloud(
          edgeNodeId,
          message,
        );

      case 'DISPLAY_COMMAND_REQUESTED_FROM_CLOUD':
        return this.applyDisplayCommandFromCloud(
          edgeNodeId,
          message,
        );

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

  private async applyManagerLotAccessReviewFromCloud(
    edgeNodeId: string,
    message: ResolvedCloudMessage,
  ) {
    const payload = message.payload;

    const status =
      message.eventType ===
      "MANAGER_LOT_ACCESS_APPROVED_FROM_CLOUD"
        ? "APPROVED"
        : message.eventType ===
            "MANAGER_LOT_ACCESS_REJECTED_FROM_CLOUD"
          ? "REJECTED"
          : this.stringValue(
              payload.status,
            );

    if (
      status !== "APPROVED" &&
      status !== "REJECTED"
    ) {
      throw new BadRequestException(
        "Manager lot review sync requires APPROVED or REJECTED status",
      );
    }

    const cloudApprovalRequestId =
      this.stringValue(
        payload.cloudApprovalRequestId,
      ) ??
      this.stringValue(
        payload.approvalRequestId,
      );

    const edgeApprovalRequestId =
      this.stringValue(
        payload.edgeApprovalRequestId,
      ) ??
      cloudApprovalRequestId;

    const requesterId =
      this.stringValue(
        payload.requesterId,
      );

    const parkingLotId =
      this.stringValue(
        payload.parkingLotId,
      );

    const sourceEdgeNodeId =
      this.stringValue(
        payload.sourceEdgeNodeId,
      );

    if (
      sourceEdgeNodeId &&
      sourceEdgeNodeId !== edgeNodeId
    ) {
      throw new BadRequestException(
        `Manager lot review is for another Edge: ${sourceEdgeNodeId}`,
      );
    }

    if (!edgeApprovalRequestId) {
      throw new BadRequestException(
        "Manager lot review sync requires edgeApprovalRequestId",
      );
    }

    if (!requesterId) {
      throw new BadRequestException(
        "Manager lot review sync requires requesterId",
      );
    }

    if (!parkingLotId) {
      throw new BadRequestException(
        "Manager lot review sync requires parkingLotId",
      );
    }

    let localRequest =
      await this.prisma
        .approvalRequest.findUnique({
          where: {
            id: edgeApprovalRequestId,
          },
        });

    if (!localRequest) {
      localRequest =
        await this.prisma
          .approvalRequest.findFirst({
            where: {
              requesterId,
              requestedParkingLotId:
                parkingLotId,
              type: {
                in: [
                  "MANAGER_LOT_ACCESS",
                  "PARKING_LOT_ACCESS",
                ],
              },
            },
            orderBy: {
              createdAt: "desc",
            },
          });
    }

    if (!localRequest) {
      throw new BadRequestException(
        `Edge approval request not found: ${edgeApprovalRequestId}`,
      );
    }

    if (
      localRequest.requesterId !==
        requesterId ||
      localRequest.requestedParkingLotId !==
        parkingLotId
    ) {
      throw new BadRequestException(
        "Edge approval request does not match requester or parking lot",
      );
    }

    const [
      managerProfile,
      parkingLot,
    ] = await Promise.all([
      this.prisma.managerProfile.findUnique({
        where: {
          userId: requesterId,
        },
      }),
      this.prisma.parkingLot.findUnique({
        where: {
          id: parkingLotId,
        },
      }),
    ]);

    if (!managerProfile) {
      throw new BadRequestException(
        `Edge manager profile not found: ${requesterId}`,
      );
    }

    if (!parkingLot) {
      throw new BadRequestException(
        `Edge parking lot not found: ${parkingLotId}`,
      );
    }

    const reviewedAtRaw =
      this.stringValue(
        payload.reviewedAt,
      );

    const parsedReviewedAt =
      reviewedAtRaw
        ? new Date(reviewedAtRaw)
        : new Date();

    const reviewedAt =
      Number.isNaN(
        parsedReviewedAt.getTime(),
      )
        ? new Date()
        : parsedReviewedAt;

    const reviewedById =
      this.stringValue(
        payload.reviewedById,
      );

    const localReviewer =
      reviewedById
        ? await this.prisma.user.findUnique({
            where: {
              id: reviewedById,
            },
            select: {
              id: true,
            },
          })
        : null;

    const rejectionReason =
      status === "REJECTED"
        ? this.stringValue(
            payload.rejectionReason,
          )
        : null;

    const result =
      await this.prisma.$transaction(
        async (tx) => {
          const currentRequestData =
            this.asRecord(
              localRequest.requestData,
            );

          const approvalUpdate:
            Record<string, unknown> = {
              status,
              reviewedAt,
              rejectionReason,
              requestData: {
                ...currentRequestData,
                cloudApprovalRequestId:
                  cloudApprovalRequestId ??
                  null,
                edgeApprovalRequestId:
                  localRequest.id,
                cloudReviewStatus:
                  status,
                cloudReviewedById:
                  reviewedById,
                cloudReviewedAt:
                  reviewedAt.toISOString(),
                cloudRejectionReason:
                  rejectionReason,
                cloudToEdgeCursor:
                  message.cursor,
                cloudToEdgeOutboxId:
                  message.outboxId,
                syncedReviewFromCloud:
                  true,
              },
            };

          if (localReviewer) {
            approvalUpdate.reviewedById =
              localReviewer.id;
          }

          const updatedRequest =
            await tx.approvalRequest.update({
              where: {
                id: localRequest.id,
              },
              data:
                approvalUpdate as any,
            });

          if (status === "APPROVED") {
            await tx.managerParkingLot.upsert({
              where: {
                managerProfileUserId_parkingLotId:
                  {
                    managerProfileUserId:
                      requesterId,
                    parkingLotId,
                  },
              },
              update: {},
              create: {
                managerProfileUserId:
                  requesterId,
                parkingLotId,
              },
            });

            const existingScope =
              await tx.userScopeBinding.findFirst({
                where: {
                  userId: requesterId,
                  scopeType: "LOT" as any,
                  parkingLotId,
                },
                select: {
                  id: true,
                },
              });

            if (!existingScope) {
              await tx.userScopeBinding.create({
                data: {
                  userId: requesterId,
                  scopeType:
                    "LOT" as any,
                  parkingLotId,
                },
              });
            }

            const managerUpdate:
              Record<string, unknown> = {
                approvedAt: reviewedAt,
              };

            if (localReviewer) {
              managerUpdate.approvedById =
                localReviewer.id;
            }

            await tx.managerProfile.update({
              where: {
                userId: requesterId,
              },
              data:
                managerUpdate as any,
            });
          }

          return updatedRequest;
        },
      );

    return {
      ok: true,
      applied: true,
      action:
        status === "APPROVED"
          ? "MANAGER_LOT_ACCESS_APPROVAL_APPLIED_FROM_CLOUD"
          : "MANAGER_LOT_ACCESS_REJECTION_APPLIED_FROM_CLOUD",
      edgeNodeId,
      cursor: message.cursor,
      outboxId: message.outboxId,
      eventType: message.eventType,
      approvalRequestId:
        result.id,
      cloudApprovalRequestId,
      requesterId,
      parkingLotId,
      status,
    };
  }

  private async applyParkingLotOperationSnapshotFromCloud(
    edgeNodeId: string,
    message: ResolvedCloudMessage,
  ) {
    /*
     * 주차장과 ManagementCompany는 기존 검증된 적용 로직을
     * 먼저 재사용한다.
     */
    const configurationResult =
      await this.applyParkingLotConfigurationFromCloud(
        edgeNodeId,
        message,
      );

    if (
      !configurationResult.applied ||
      !configurationResult.parkingLotId
    ) {
      return configurationResult;
    }

    const payload = message.payload;
    const localParkingLotId =
      configurationResult.parkingLotId;
    const appliedAt = new Date().toISOString();

    const recordArray = (
      value: unknown,
    ): Record<string, any>[] => {
      if (!Array.isArray(value)) {
        return [];
      }

      return value.filter(
        (
          item,
        ): item is Record<string, any> =>
          Boolean(item) &&
          typeof item === 'object' &&
          !Array.isArray(item),
      );
    };

    const nullableText = (
      value: unknown,
    ): string | null => {
      if (
        value === null ||
        value === undefined
      ) {
        return null;
      }

      const normalized =
        String(value).trim();

      return normalized || null;
    };

    const requiredText = (
      value: unknown,
      label: string,
    ) => {
      const normalized =
        nullableText(value);

      if (!normalized) {
        throw new BadRequestException(
          `${label} is required`,
        );
      }

      return normalized;
    };

    const nullableNumber = (
      value: unknown,
    ): number | null => {
      if (
        typeof value !== 'number' ||
        !Number.isFinite(value)
      ) {
        return null;
      }

      return value;
    };

    const requiredNumber = (
      value: unknown,
      label: string,
    ) => {
      const normalized =
        nullableNumber(value);

      if (normalized === null) {
        throw new BadRequestException(
          `${label} must be a finite number`,
        );
      }

      return normalized;
    };

    const booleanValue = (
      value: unknown,
      fallback: boolean,
    ) =>
      typeof value === 'boolean'
        ? value
        : fallback;

    const nullableDate = (
      value: unknown,
      label: string,
    ): Date | null => {
      if (
        value === null ||
        value === undefined ||
        value === ''
      ) {
        return null;
      }

      const parsed =
        new Date(String(value));

      if (Number.isNaN(parsed.getTime())) {
        throw new BadRequestException(
          `${label} must be a valid date`,
        );
      }

      return parsed;
    };

    const sections =
      recordArray(payload.sections);
    const spaces =
      recordArray(payload.spaces);
    const sensorDevices =
      recordArray(payload.sensorDevices);
    const feePolicies =
      recordArray(payload.feePolicies);
    const eligibilityDefinitions =
      recordArray(
        payload.discountEligibilityDefinitions,
      );
    const discountPrograms =
      recordArray(payload.discountPrograms);

    const result =
      await this.prisma.$transaction(
        async (tx) => {
          const sectionIdMap =
            new Map<string, string>();
          const spaceIdMap =
            new Map<string, string>();
          const spaceSectionIdMap =
            new Map<string, string>();
          const eligibilityIdMap =
            new Map<string, string>();

          const syncedSectionIds: string[] = [];
          const syncedSpaceIds: string[] = [];
          const syncedSensorIds: string[] = [];
          const syncedFeePolicyIds: string[] = [];
          const syncedDiscountProgramIds:
            string[] = [];

          /*
           * 1. ParkingSection
           */
          for (const item of sections) {
            const cloudSectionId =
              requiredText(
                item.id,
                'ParkingSection.id',
              );
            const name =
              requiredText(
                item.name,
                'ParkingSection.name',
              );
            const code =
              nullableText(item.code);

            const orConditions:
              Array<Record<string, any>> = [
                {
                  id: cloudSectionId,
                },
              ];

            if (code) {
              orConditions.push({
                parkingLotId:
                  localParkingLotId,
                code,
              });
            }

            const existing =
              await tx.parkingSection.findFirst({
                where: {
                  OR: orConditions,
                },
              });

            const sectionData:
              Record<string, any> = {
                parkingLotId:
                  localParkingLotId,
                name,
                code,
                centerLat:
                  nullableNumber(
                    item.centerLat,
                  ),
                centerLng:
                  nullableNumber(
                    item.centerLng,
                  ),
                isActive:
                  booleanValue(
                    item.isActive,
                    true,
                  ),
              };

            if (
              item.polygonJson !== null &&
              item.polygonJson !== undefined
            ) {
              sectionData.polygonJson =
                item.polygonJson;
            }

            const saved = existing
              ? await tx.parkingSection.update({
                  where: {
                    id: existing.id,
                  },
                  data: sectionData,
                })
              : await tx.parkingSection.create({
                  data: {
                    id: cloudSectionId,
                    ...sectionData,
                  } as any,
                });

            sectionIdMap.set(
              cloudSectionId,
              saved.id,
            );
            syncedSectionIds.push(saved.id);
          }

          /*
           * Snapshot에 없는 구역은 삭제하지 않고 비활성화한다.
           */
          await tx.parkingSection.updateMany({
            where: {
              parkingLotId:
                localParkingLotId,
              ...(syncedSectionIds.length > 0
                ? {
                    id: {
                      notIn:
                        syncedSectionIds,
                    },
                  }
                : {}),
            },
            data: {
              isActive: false,
            },
          });

          /*
           * 2. ParkingSpace
           *
           * status 필드는 의도적으로 update/create payload에서
           * 제외하거나 신규 생성 시 EMPTY만 사용한다.
           */
          for (const item of spaces) {
            const cloudSpaceId =
              requiredText(
                item.id,
                'ParkingSpace.id',
              );
            const cloudSectionId =
              requiredText(
                item.sectionId,
                'ParkingSpace.sectionId',
              );
            const localSectionId =
              sectionIdMap.get(
                cloudSectionId,
              );

            if (!localSectionId) {
              throw new BadRequestException(
                `Snapshot section mapping not found: ${cloudSectionId}`,
              );
            }

            const code =
              requiredText(
                item.code,
                'ParkingSpace.code',
              );

            const existing =
              await tx.parkingSpace.findFirst({
                where: {
                  OR: [
                    {
                      id: cloudSpaceId,
                    },
                    {
                      sectionId:
                        localSectionId,
                      code,
                    },
                  ],
                },
              });

            const spaceData:
              Record<string, any> = {
                sectionId:
                  localSectionId,
                code,
                number:
                  nullableText(item.number),
                type:
                  requiredText(
                    item.type,
                    'ParkingSpace.type',
                  ) as any,
                lat:
                  nullableNumber(item.lat),
                lng:
                  nullableNumber(item.lng),
                widthMeter:
                  nullableNumber(
                    item.widthMeter,
                  ),
                heightMeter:
                  nullableNumber(
                    item.heightMeter,
                  ),
                rotationDeg:
                  nullableNumber(
                    item.rotationDeg,
                  ),
                posX:
                  nullableNumber(item.posX),
                posY:
                  nullableNumber(item.posY),
                isActive:
                  booleanValue(
                    item.isActive,
                    true,
                  ),
              };

            if (
              item.polygonJson !== null &&
              item.polygonJson !== undefined
            ) {
              spaceData.polygonJson =
                item.polygonJson;
            }

            const saved = existing
              ? await tx.parkingSpace.update({
                  where: {
                    id: existing.id,
                  },
                  data: spaceData,
                })
              : await tx.parkingSpace.create({
                  data: {
                    id: cloudSpaceId,
                    ...spaceData,
                    status: 'EMPTY' as any,
                  } as any,
                });

            spaceIdMap.set(
              cloudSpaceId,
              saved.id,
            );
            spaceSectionIdMap.set(
              cloudSpaceId,
              localSectionId,
            );
            syncedSpaceIds.push(saved.id);
          }

          const allLotSections =
            await tx.parkingSection.findMany({
              where: {
                parkingLotId:
                  localParkingLotId,
              },
              select: {
                id: true,
              },
            });

          const allLotSectionIds =
            allLotSections.map(
              (section: any) =>
                section.id,
            );

          if (allLotSectionIds.length > 0) {
            await tx.parkingSpace.updateMany({
              where: {
                sectionId: {
                  in: allLotSectionIds,
                },
                ...(syncedSpaceIds.length > 0
                  ? {
                      id: {
                        notIn:
                          syncedSpaceIds,
                      },
                    }
                  : {}),
              },
              data: {
                isActive: false,
              },
            });
          }

          /*
           * 3. SensorDevice
           *
           * SensorDevice.status, lastSeenAt 및 현장 telemetry는
           * 기존 Edge 값을 우선 보존한다.
           */
          for (const item of sensorDevices) {
            const cloudSensorId =
              requiredText(
                item.id,
                'SensorDevice.id',
              );
            const serialNumber =
              requiredText(
                item.serialNumber,
                'SensorDevice.serialNumber',
              );
            const devEui =
              nullableText(item.devEui);

            const cloudSectionId =
              nullableText(
                item.parkingSectionId,
              );
            const cloudSpaceId =
              nullableText(
                item.parkingSpaceId,
              );

            const localSpaceId =
              cloudSpaceId
                ? spaceIdMap.get(
                    cloudSpaceId,
                  ) ?? null
                : null;

            const localSectionId =
              cloudSectionId
                ? sectionIdMap.get(
                    cloudSectionId,
                  ) ?? null
                : cloudSpaceId
                  ? spaceSectionIdMap.get(
                      cloudSpaceId,
                    ) ?? null
                  : null;

            const orConditions:
              Array<Record<string, any>> = [
                {
                  id: cloudSensorId,
                },
                {
                  serialNumber,
                },
              ];

            if (devEui) {
              orConditions.push({
                devEui,
              });
            }

            const existing =
              await tx.sensorDevice.findFirst({
                where: {
                  OR: orConditions,
                },
              });

            if (localSpaceId) {
              await tx.sensorDevice.updateMany({
                where: {
                  parkingSpaceId:
                    localSpaceId,
                  ...(existing
                    ? {
                        id: {
                          not:
                            existing.id,
                        },
                      }
                    : {}),
                },
                data: {
                  parkingSpaceId: null,
                },
              });
            }

            const existingMetadata =
              this.asRecord(
                existing?.metadata,
              );
            const cloudMetadata =
              this.asRecord(item.metadata);

            const sensorData:
              Record<string, any> = {
                name:
                  requiredText(
                    item.name,
                    'SensorDevice.name',
                  ),
                type:
                  requiredText(
                    item.type,
                    'SensorDevice.type',
                  ),
                serialNumber,
                devEui,
                macAddress:
                  nullableText(
                    item.macAddress,
                  ),
                ipAddress:
                  nullableText(
                    item.ipAddress,
                  ),
                installLocation:
                  nullableText(
                    item.installLocation,
                  ),
                parkingLotId:
                  localParkingLotId,
                parkingSectionId:
                  localSectionId,
                parkingSpaceId:
                  localSpaceId,
                metadata: {
                  ...existingMetadata,
                  cloudConfiguration: {
                    ...cloudMetadata,
                    cloudSensorId,
                    syncedAt: appliedAt,
                  },
                } as any,
              };

            if (existing) {
              sensorData.firmwareVersion =
                existing.firmwareVersion ??
                nullableText(
                  item.firmwareVersion,
                );

              const saved =
                await tx.sensorDevice.update({
                  where: {
                    id: existing.id,
                  },
                  data: sensorData,
                });

              syncedSensorIds.push(saved.id);
            } else {
              const saved =
                await tx.sensorDevice.create({
                  data: {
                    id: cloudSensorId,
                    ...sensorData,
                    firmwareVersion:
                      nullableText(
                        item.firmwareVersion,
                      ),
                    status:
                      (
                        nullableText(
                          item.status,
                        ) ?? 'ACTIVE'
                      ) as any,
                  } as any,
                });

              syncedSensorIds.push(saved.id);
            }
          }

          /*
           * sensorInventoryAuthoritative=false인 동안에는
           * Snapshot에 없는 Edge 센서를 비활성화하거나 제거하지 않는다.
           */

          /*
           * 4. FeePolicy + FeePolicyTimeRule
           */
          for (const item of feePolicies) {
            const cloudPolicyId =
              requiredText(
                item.id,
                'FeePolicy.id',
              );
            const code =
              nullableText(item.code);

            const orConditions:
              Array<Record<string, any>> = [
                {
                  id: cloudPolicyId,
                },
              ];

            if (code) {
              orConditions.push({
                parkingLotId:
                  localParkingLotId,
                code,
              });
            }

            const existing =
              await tx.feePolicy.findFirst({
                where: {
                  OR: orConditions,
                },
              });

            const feePolicyData:
              Record<string, any> = {
                parkingLotId:
                  localParkingLotId,
                code,
                name:
                  nullableText(item.name),
                vehicleType:
                  requiredText(
                    item.vehicleType,
                    'FeePolicy.vehicleType',
                  ),
                baseMinutes:
                  Math.trunc(
                    requiredNumber(
                      item.baseMinutes,
                      'FeePolicy.baseMinutes',
                    ),
                  ),
                baseFee:
                  Math.trunc(
                    requiredNumber(
                      item.baseFee,
                      'FeePolicy.baseFee',
                    ),
                  ),
                unitMinutes:
                  Math.trunc(
                    requiredNumber(
                      item.unitMinutes,
                      'FeePolicy.unitMinutes',
                    ),
                  ),
                unitFee:
                  Math.trunc(
                    requiredNumber(
                      item.unitFee,
                      'FeePolicy.unitFee',
                    ),
                  ),
                memberDiscountPercent:
                  Math.trunc(
                    requiredNumber(
                      item.memberDiscountPercent,
                      'FeePolicy.memberDiscountPercent',
                    ),
                  ),
                dailyMax:
                  nullableNumber(
                    item.dailyMax,
                  ),
                graceMinutes:
                  Math.trunc(
                    requiredNumber(
                      item.graceMinutes,
                      'FeePolicy.graceMinutes',
                    ),
                  ),
                exitGraceMinutes:
                  Math.trunc(
                    requiredNumber(
                      item.exitGraceMinutes,
                      'FeePolicy.exitGraceMinutes',
                    ),
                  ),
                registrationGraceMinutes:
                  Math.trunc(
                    requiredNumber(
                      item.registrationGraceMinutes,
                      'FeePolicy.registrationGraceMinutes',
                    ),
                  ),
                registrationGraceFee:
                  Math.trunc(
                    requiredNumber(
                      item.registrationGraceFee,
                      'FeePolicy.registrationGraceFee',
                    ),
                  ),
                registrationGraceDiscountEnabled:
                  booleanValue(
                    item.registrationGraceDiscountEnabled,
                    true,
                  ),
                authorityRegistrationGraceDiscountEnabled:
                  booleanValue(
                    item.authorityRegistrationGraceDiscountEnabled,
                    false,
                  ),
                watcherRewardGraceFeeEnabled:
                  booleanValue(
                    item.watcherRewardGraceFeeEnabled,
                    false,
                  ),
                taxType:
                  (
                    nullableText(item.taxType) ??
                    'VAT_INCLUDED'
                  ) as any,
                isActive:
                  booleanValue(
                    item.isActive,
                    true,
                  ),
                validFrom:
                  nullableDate(
                    item.validFrom,
                    'FeePolicy.validFrom',
                  ),
                validTo:
                  nullableDate(
                    item.validTo,
                    'FeePolicy.validTo',
                  ),
              };

            const saved = existing
              ? await tx.feePolicy.update({
                  where: {
                    id: existing.id,
                  },
                  data: feePolicyData,
                })
              : await tx.feePolicy.create({
                  data: {
                    id: cloudPolicyId,
                    ...feePolicyData,
                  } as any,
                });

            syncedFeePolicyIds.push(
              saved.id,
            );

            await tx.feePolicyTimeRule.deleteMany({
              where: {
                feePolicyId: saved.id,
              },
            });

            const timeRules =
              recordArray(item.timeRules);

            if (timeRules.length > 0) {
              await tx.feePolicyTimeRule.createMany({
                data: timeRules.map(
                  (
                    rule,
                    index,
                  ) => ({
                    id:
                      nullableText(
                        rule.id,
                      ) ??
                      `${saved.id}-rule-${index + 1}`,
                    feePolicyId:
                      saved.id,
                    startHour:
                      Math.trunc(
                        requiredNumber(
                          rule.startHour,
                          'FeePolicyTimeRule.startHour',
                        ),
                      ),
                    endHour:
                      Math.trunc(
                        requiredNumber(
                          rule.endHour,
                          'FeePolicyTimeRule.endHour',
                        ),
                      ),
                    multiplier:
                      requiredNumber(
                        rule.multiplier,
                        'FeePolicyTimeRule.multiplier',
                      ),
                  }),
                ),
              });
            }
          }

          await tx.feePolicy.updateMany({
            where: {
              parkingLotId:
                localParkingLotId,
              ...(syncedFeePolicyIds.length > 0
                ? {
                    id: {
                      notIn:
                        syncedFeePolicyIds,
                    },
                  }
                : {}),
            },
            data: {
              isActive: false,
            },
          });

          /*
           * 5. DiscountEligibilityDefinition
           */
          for (
            const item of
            eligibilityDefinitions
          ) {
            const cloudDefinitionId =
              requiredText(
                item.id,
                'DiscountEligibilityDefinition.id',
              );
            const code =
              requiredText(
                item.code,
                'DiscountEligibilityDefinition.code',
              );

            const existing =
              await tx.discountEligibilityDefinition.findFirst({
                where: {
                  OR: [
                    {
                      id: cloudDefinitionId,
                    },
                    {
                      code,
                    },
                  ],
                },
              });

            const definitionData:
              Record<string, any> = {
                code,
                name:
                  requiredText(
                    item.name,
                    'DiscountEligibilityDefinition.name',
                  ),
                scope:
                  requiredText(
                    item.scope,
                    'DiscountEligibilityDefinition.scope',
                  ) as any,
                description:
                  nullableText(
                    item.description,
                  ),
                isActive:
                  booleanValue(
                    item.isActive,
                    true,
                  ),
                displayOrder:
                  Math.trunc(
                    requiredNumber(
                      item.displayOrder,
                      'DiscountEligibilityDefinition.displayOrder',
                    ),
                  ),
              };

            const saved = existing
              ? await tx.discountEligibilityDefinition.update({
                  where: {
                    id: existing.id,
                  },
                  data: definitionData,
                })
              : await tx.discountEligibilityDefinition.create({
                  data: {
                    id: cloudDefinitionId,
                    ...definitionData,
                  } as any,
                });

            eligibilityIdMap.set(
              cloudDefinitionId,
              saved.id,
            );
          }

          /*
           * 6. ParkingDiscountProgram
           */
          for (const item of discountPrograms) {
            const cloudProgramId =
              requiredText(
                item.id,
                'ParkingDiscountProgram.id',
              );
            const code =
              requiredText(
                item.code,
                'ParkingDiscountProgram.code',
              );
            const cloudEligibilityId =
              requiredText(
                item.eligibilityDefinitionId,
                'ParkingDiscountProgram.eligibilityDefinitionId',
              );
            const localEligibilityId =
              eligibilityIdMap.get(
                cloudEligibilityId,
              );

            if (!localEligibilityId) {
              throw new BadRequestException(
                `Discount eligibility mapping not found: ${cloudEligibilityId}`,
              );
            }

            const existing =
              await tx.parkingDiscountProgram.findFirst({
                where: {
                  OR: [
                    {
                      id: cloudProgramId,
                    },
                    {
                      parkingLotId:
                        localParkingLotId,
                      code,
                    },
                  ],
                },
              });

            const programData:
              Record<string, any> = {
                parkingLotId:
                  localParkingLotId,
                eligibilityDefinitionId:
                  localEligibilityId,
                code,
                name:
                  requiredText(
                    item.name,
                    'ParkingDiscountProgram.name',
                  ),
                description:
                  nullableText(
                    item.description,
                  ),
                benefitType:
                  requiredText(
                    item.benefitType,
                    'ParkingDiscountProgram.benefitType',
                  ) as any,
                benefitValue:
                  Math.trunc(
                    requiredNumber(
                      item.benefitValue,
                      'ParkingDiscountProgram.benefitValue',
                    ),
                  ),
                priority:
                  Math.trunc(
                    requiredNumber(
                      item.priority,
                      'ParkingDiscountProgram.priority',
                    ),
                  ),
                stackable:
                  booleanValue(
                    item.stackable,
                    true,
                  ),
                stackableWithCoupon:
                  booleanValue(
                    item.stackableWithCoupon,
                    true,
                  ),
                maxDiscountAmount:
                  nullableNumber(
                    item.maxDiscountAmount,
                  ),
                minimumPayableAmount:
                  Math.trunc(
                    requiredNumber(
                      item.minimumPayableAmount,
                      'ParkingDiscountProgram.minimumPayableAmount',
                    ),
                  ),
                isActive:
                  booleanValue(
                    item.isActive,
                    true,
                  ),
                validFrom:
                  nullableDate(
                    item.validFrom,
                    'ParkingDiscountProgram.validFrom',
                  ),
                validUntil:
                  nullableDate(
                    item.validUntil,
                    'ParkingDiscountProgram.validUntil',
                  ),
              };

            const saved = existing
              ? await tx.parkingDiscountProgram.update({
                  where: {
                    id: existing.id,
                  },
                  data: programData,
                })
              : await tx.parkingDiscountProgram.create({
                  data: {
                    id: cloudProgramId,
                    ...programData,
                  } as any,
                });

            syncedDiscountProgramIds.push(
              saved.id,
            );
          }

          await tx.parkingDiscountProgram.updateMany({
            where: {
              parkingLotId:
                localParkingLotId,
              ...(syncedDiscountProgramIds.length > 0
                ? {
                    id: {
                      notIn:
                        syncedDiscountProgramIds,
                    },
                  }
                : {}),
            },
            data: {
              isActive: false,
            },
          });

          return {
            sectionCount:
              syncedSectionIds.length,
            spaceCount:
              syncedSpaceIds.length,
            sensorCount:
              syncedSensorIds.length,
            feePolicyCount:
              syncedFeePolicyIds.length,
            eligibilityDefinitionCount:
              eligibilityDefinitions.length,
            discountProgramCount:
              syncedDiscountProgramIds.length,
          };
        },
      );

    return {
      ...configurationResult,
      action:
        'CLOUD_PARKING_LOT_OPERATION_SNAPSHOT_APPLIED',
      snapshotVersion:
        this.numberValue(
          payload.snapshotVersion,
        ) ?? 1,
      snapshotAppliedAt: appliedAt,
      sensorInventoryAuthoritative:
        payload.sensorInventoryAuthoritative ===
        true,
      ...result,
    };
  }

  private async applyParkingLotConfigurationFromCloud(
    edgeNodeId: string,
    message: ResolvedCloudMessage,
  ) {
    const payload = message.payload;
    const parkingLotId =
      this.stringValue(payload.parkingLotId) ??
      this.stringValue(payload.id);
    const code = this.stringValue(payload.code);

    if (!parkingLotId && !code) {
      throw new BadRequestException(
        'Parking lot sync requires parkingLotId or code',
      );
    }

    const orConditions: Array<Record<string, string>> = [];

    if (parkingLotId) {
      orConditions.push({
        id: parkingLotId,
      });
    }

    if (code) {
      orConditions.push({
        code,
      });
    }

    const localLot = await this.prisma.parkingLot.findFirst({
      where: {
        OR: orConditions,
      },
    });

    if (!localLot) {
      return {
        ok: false,
        applied: false,
        action: 'LOCAL_PARKING_LOT_NOT_FOUND',
        edgeNodeId,
        cursor: message.cursor,
        outboxId: message.outboxId,
        eventType: message.eventType,
        parkingLotId,
        code,
      };
    }

    const has = (key: string) =>
      Object.prototype.hasOwnProperty.call(payload, key);

    const nullableText = (
      key: string,
      fallback: string | null,
    ) => {
      if (!has(key)) {
        return fallback;
      }

      const value = payload[key];

      if (value === null || value === undefined) {
        return null;
      }

      const normalized = String(value).trim();
      return normalized || null;
    };

    const requiredText = (
      key: string,
      fallback: string,
    ) => {
      if (!has(key)) {
        return fallback;
      }

      const value = this.stringValue(payload[key]);
      return value ?? fallback;
    };

    const numericValue = (
      key: string,
      fallback: number | null,
    ): number | null => {
      if (!has(key)) {
        return fallback;
      }

      return this.numberValue(payload[key]) ?? fallback;
    };

    const operationMode =
      payload.operationMode === 'MANUAL'
        ? 'MANUAL'
        : payload.operationMode === 'SENSOR'
          ? 'SENSOR'
          : localLot.operationMode;

    const isActive =
      typeof payload.isActive === 'boolean'
        ? payload.isActive
        : localLot.isActive;

    const managementCompanyId = has('managementCompanyId')
      ? this.stringValue(payload.managementCompanyId)
      : localLot.managementCompanyId;

    const managementCompanyPayload =
      this.asRecordOrNull(payload.managementCompany);

    const updatedLot = await this.prisma.$transaction(
      async (tx) => {
        let resolvedManagementCompanyId =
          managementCompanyId;

        if (managementCompanyPayload) {
          const syncedManagementCompanyId =
            this.stringValue(
              managementCompanyPayload.id,
            ) ?? managementCompanyId;

          const syncedManagementCompanyName =
            this.stringValue(
              managementCompanyPayload.name,
            );

          const syncedManagementCompanyCode =
            this.stringValue(
              managementCompanyPayload.code,
            );

          if (
            !syncedManagementCompanyId ||
            !syncedManagementCompanyName ||
            !syncedManagementCompanyCode
          ) {
            throw new BadRequestException(
              'Management company sync requires id, name and code',
            );
          }

          const nestedNullableText = (
            key: string,
          ): string | null => {
            const value =
              managementCompanyPayload[key];

            if (
              value === null ||
              value === undefined
            ) {
              return null;
            }

            const normalized =
              String(value).trim();

            return normalized || null;
          };

          const syncedManagementCompany =
            await tx.managementCompany.upsert({
              where: {
                id: syncedManagementCompanyId,
              },
              create: {
                id: syncedManagementCompanyId,
                name: syncedManagementCompanyName,
                code: syncedManagementCompanyCode,
                businessNumber:
                  nestedNullableText(
                    'businessNumber',
                  ),
                representative:
                  nestedNullableText(
                    'representative',
                  ),
                contact:
                  nestedNullableText('contact'),
                address:
                  nestedNullableText('address'),
                memo:
                  nestedNullableText('memo'),
                isActive:
                  typeof managementCompanyPayload.isActive ===
                  'boolean'
                    ? managementCompanyPayload.isActive
                    : true,
              },
              update: {
                name: syncedManagementCompanyName,
                code: syncedManagementCompanyCode,
                businessNumber:
                  nestedNullableText(
                    'businessNumber',
                  ),
                representative:
                  nestedNullableText(
                    'representative',
                  ),
                contact:
                  nestedNullableText('contact'),
                address:
                  nestedNullableText('address'),
                memo:
                  nestedNullableText('memo'),
                isActive:
                  typeof managementCompanyPayload.isActive ===
                  'boolean'
                    ? managementCompanyPayload.isActive
                    : true,
              },
            });

          resolvedManagementCompanyId =
            syncedManagementCompany.id;
        } else if (managementCompanyId) {
          const existingManagementCompany =
            await tx.managementCompany.findUnique({
              where: {
                id: managementCompanyId,
              },
              select: {
                id: true,
              },
            });

          if (!existingManagementCompany) {
            throw new BadRequestException(
              `Management company not found on Edge: ${managementCompanyId}`,
            );
          }
        }

        return tx.parkingLot.update({
          where: {
            id: localLot.id,
          },
          data: {
            code: requiredText(
              'code',
              localLot.code,
            ),
            name: requiredText(
              'name',
              localLot.name,
            ),
            region: nullableText(
              'region',
              localLot.region,
            ),
            district: nullableText(
              'district',
              localLot.district,
            ),
            address: nullableText(
              'address',
              localLot.address,
            ),
            lat: numericValue(
              'lat',
              localLot.lat,
            ),
            lng: numericValue(
              'lng',
              localLot.lng,
            ),
            centerLat: numericValue(
              'centerLat',
              localLot.centerLat,
            ),
            centerLng: numericValue(
              'centerLng',
              localLot.centerLng,
            ),
            representative: nullableText(
              'representative',
              localLot.representative,
            ),
            contact: nullableText(
              'contact',
              localLot.contact,
            ),
            operationMode: operationMode as any,
            isActive,
            managementCompanyId:
              resolvedManagementCompanyId,
          },
        });
      },
    );

    return {
      ok: true,
      applied: true,
      action:
        'CLOUD_PARKING_LOT_CONFIGURATION_APPLIED',
      edgeNodeId,
      cursor: message.cursor,
      outboxId: message.outboxId,
      eventType: message.eventType,
      parkingLotId: updatedLot.id,
      code: updatedLot.code,
      operationMode: updatedLot.operationMode,
      isActive: updatedLot.isActive,
      managementCompanyId:
        updatedLot.managementCompanyId,
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

    /*
     * Cloud 공식 Invoice를 legacy invoiceId에 적용하기 전에
     * Edge 로컬 Invoice namespace를 별도로 보존한다.
     */
    const edgeInvoiceId =
      this.stringValue(payload.edgeInvoiceId) ??
      metadata.edgeInvoiceId ??
      session.primaryInvoiceId ??
      null;

    const edgeInvoiceNo =
      this.stringValue(payload.edgeInvoiceNo) ??
      metadata.edgeInvoiceNo ??
      null;

    const edgeInvoiceStatus =
      this.stringValue(payload.edgeInvoiceStatus) ??
      metadata.edgeInvoiceStatus ??
      metadata.invoiceStatus ??
      null;

    const edgeInvoiceAmount =
      this.numberValue(payload.edgeInvoiceAmount) ??
      metadata.edgeInvoiceAmount ??
      metadata.invoiceAmount ??
      session.amount ??
      null;

    const edgeInvoicePaidAmount =
      this.numberValue(payload.edgeInvoicePaidAmount) ??
      metadata.edgeInvoicePaidAmount ??
      metadata.invoicePaidAmount ??
      session.paidAmount ??
      null;

    const edgeInvoiceUnpaidAmount =
      this.numberValue(payload.edgeInvoiceUnpaidAmount) ??
      metadata.edgeInvoiceUnpaidAmount ??
      metadata.invoiceUnpaidAmount ??
      session.unpaidAmount ??
      null;

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

          /*
           * Edge에서 먼저 생성된 로컬 Invoice.
           * Cloud 공식 Invoice와 별도 namespace로 유지한다.
           */
          edgeInvoiceId,
          edgeInvoiceNo,
          edgeInvoiceStatus,
          edgeInvoiceAmount,
          edgeInvoicePaidAmount,
          edgeInvoiceUnpaidAmount,

          /*
           * Cloud가 발급한 공식 결제·수금 Invoice.
           */
          cloudInvoiceId:
            this.stringValue(payload.invoiceId) ??
            metadata.cloudInvoiceId ??
            null,
          cloudInvoiceNo:
            this.stringValue(payload.invoiceNo) ??
            metadata.cloudInvoiceNo ??
            null,
          cloudInvoiceStatus:
            this.stringValue(payload.invoiceStatus) ??
            metadata.cloudInvoiceStatus ??
            null,
          cloudInvoiceAmount:
            this.numberValue(payload.invoiceAmount) ??
            metadata.cloudInvoiceAmount ??
            null,
          cloudInvoicePaidAmount:
            invoicePaidAmount ??
            metadata.cloudInvoicePaidAmount ??
            null,
          cloudInvoiceUnpaidAmount:
            invoiceUnpaidAmount ??
            metadata.cloudInvoiceUnpaidAmount ??
            null,

          /*
           * 기존 결제 코드 호환용 공식 Invoice 필드.
           */
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
          invoiceCreatedAtEdge:
            Boolean(edgeInvoiceId) ||
            metadata.invoiceCreatedAtEdge === true,
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

          /*
           * Cloud가 발급한 공식 결제·수금 Invoice.
           */
          cloudInvoiceId:
            this.stringValue(payload.invoiceId) ??
            metadata.cloudInvoiceId ??
            null,
          cloudInvoiceNo:
            this.stringValue(payload.invoiceNo) ??
            metadata.cloudInvoiceNo ??
            null,
          cloudInvoiceStatus:
            this.stringValue(payload.invoiceStatus) ??
            metadata.cloudInvoiceStatus ??
            null,
          cloudInvoiceAmount:
            this.numberValue(payload.invoiceAmount) ??
            metadata.cloudInvoiceAmount ??
            null,
          cloudInvoicePaidAmount:
            invoicePaidAmount ??
            metadata.cloudInvoicePaidAmount ??
            null,
          cloudInvoiceUnpaidAmount:
            invoiceUnpaidAmount ??
            metadata.cloudInvoiceUnpaidAmount ??
            null,

          /*
           * 기존 결제 코드 호환용 공식 Invoice 필드.
           */
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

    try {
      let result:
        Record<string, any>;

      switch (input.event.eventType) {
        case 'MANAGER_LOT_ACCESS_REQUESTED_EDGE_SYNC_REQUIRED':
          result =
            await this.applyEdgeManagerLotAccessRequest({
              edgeNodeId: input.edgeNodeId,
              event: input.event,
              payload: input.payload,
            });
          break;

        case 'PARKING_LOT_CREATED_EDGE_SYNC_REQUIRED':
          result =
            await this.applyEdgeParkingLotCreated({
              edgeNodeId: input.edgeNodeId,
              event: input.event,
              payload: input.payload,
            });
          break;

        case 'PARKING_SESSION_EXITED_UNPAID_EDGE_SYNC_REQUIRED':
          result =
            await this
              .createCloudInvoiceForEdgeUnpaidExit({
                edgeNodeId:
                  input.edgeNodeId,
                event: input.event,
                payload:
                  input.payload,
              });
          break;

        case 'PARKING_SESSION_ENTERED_FROM_EDGE':
          result =
            await this
              .applyEdgeParkingSessionEvent({
                edgeNodeId:
                  input.edgeNodeId,
                event: input.event,
                payload:
                  input.payload,
              });
          break;

        case 'PARKING_SESSION_EXITED_FROM_EDGE': {
          const sessionResult =
            await this
              .applyEdgeParkingSessionEvent({
                edgeNodeId:
                  input.edgeNodeId,
                event: input.event,
                payload:
                  input.payload,
              });

          const edgeInvoice =
            this.asRecord(
              input.payload.edgeInvoice,
            );

          const reportedInvoiceStatus =
            this.stringValue(
              edgeInvoice.status,
            ) ??
            this.stringValue(
              input.payload.invoiceStatus,
            );

          const reportedInvoicePaidAmount =
            this.numberValue(
              edgeInvoice.paidAmount,
            ) ??
            this.numberValue(
              input.payload.paidAmount,
            ) ??
            0;

          const reportedInvoiceUnpaidAmount =
            this.numberValue(
              edgeInvoice.unpaidAmount,
            ) ??
            this.numberValue(
              input.payload.unpaidAmount,
            );

          const isPaidEdgeInvoice =
            reportedInvoiceStatus === 'PAID' ||
            (
              reportedInvoicePaidAmount > 0 &&
              reportedInvoiceUnpaidAmount !== null &&
              reportedInvoiceUnpaidAmount <= 0
            );

          if (
            sessionResult.action !==
              'EDGE_SESSION_STALE_EVENT_IGNORED' &&
            isPaidEdgeInvoice
          ) {
            const cloudSessionId =
              this.stringValue(
                sessionResult.sessionId,
              ) ??
              this.stringValue(
                input.payload.sessionId,
              );

            if (!cloudSessionId) {
              throw new BadRequestException(
                'Cannot resolve Cloud session for paid Edge exit',
              );
            }

            const paidInvoiceResult =
              await this
                .createCloudInvoiceForEdgePaidExit({
                  edgeNodeId:
                    input.edgeNodeId,
                  event:
                    input.event,
                  payload:
                    input.payload,
                  cloudSessionId,
                });

            result = {
              ...sessionResult,
              action:
                'EDGE_PARKING_SESSION_EXITED_PAID_INVOICE_APPLIED',
              invoice:
                paidInvoiceResult.invoice,
            };
          } else {
            result =
              sessionResult;
          }

          break;
        }

        case 'SENSOR_TELEMETRY_REPORTED_FROM_EDGE':
        case 'PARKING_SPACE_STATUS_CHANGED_FROM_EDGE':
          result =
            await this
              .applyEdgeSensorEvent({
                edgeNodeId:
                  input.edgeNodeId,
                event: input.event,
                payload:
                  input.payload,
              });
          break;

        case 'DISPLAY_COMMAND_RESULT_FROM_EDGE':
          result =
            await this
              .applyEdgeDisplayCommandResult({
                edgeNodeId:
                  input.edgeNodeId,
                event:
                  input.event,
                payload:
                  input.payload,
              });
          break;

        default:
          return {
            processed: false,
            action:
              'IGNORED_EVENT_TYPE',
            invoice: null,
            error: null,
          };
      }

      await this.markInboxProcessed({
        messageId:
          input.messageId,
        payload:
          input.payload,
        result: result as any,
      });

      return {
        processed: true,
        action:
          String(
            result.action ??
            'PROCESSED',
          ),
        invoice:
          result.invoice ?? null,
        error: null,
      };
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : String(error);

      await this.markInboxFailed({
        messageId:
          input.messageId,
        payload:
          input.payload,
        error: message,
      });

      return {
        processed: false,
        action:
          'PROCESSING_FAILED',
        invoice: null,
        error: message,
      };
    }
  }

  private async applyEdgeManagerLotAccessRequest(
    input: {
      edgeNodeId: string;
      event: EdgePushEvent;
      payload: Record<string, unknown>;
    },
  ) {
    const approvalRequestId =
      this.stringValue(
        input.payload.approvalRequestId,
      ) ??
      this.stringValue(
        input.event.aggregateId,
      );

    const requesterId =
      this.stringValue(
        input.payload.requesterId,
      );

    const parkingLotId =
      this.stringValue(
        input.payload.parkingLotId,
      ) ??
      this.stringValue(
        input.payload.requestedParkingLotId,
      );

    if (!approvalRequestId) {
      throw new BadRequestException(
        'Manager lot access sync requires approvalRequestId',
      );
    }

    if (!requesterId) {
      throw new BadRequestException(
        'Manager lot access sync requires requesterId',
      );
    }

    if (!parkingLotId) {
      throw new BadRequestException(
        'Manager lot access sync requires parkingLotId',
      );
    }

    const [
      parkingLot,
      managerProfile,
      edgeParkingLot,
      approved,
      existingById,
    ] = await Promise.all([
      this.prisma.parkingLot.findUnique({
        where: {
          id: parkingLotId,
        },
      }),
      this.prisma.managerProfile.findUnique({
        where: {
          userId: requesterId,
        },
      }),
      this.prisma.edgeParkingLot.findUnique({
        where: {
          edgeNodeId_parkingLotId: {
            edgeNodeId:
              input.edgeNodeId,
            parkingLotId,
          },
        },
      }),
      this.prisma.managerParkingLot.findUnique({
        where: {
          managerProfileUserId_parkingLotId:
            {
              managerProfileUserId:
                requesterId,
              parkingLotId,
            },
        },
      }),
      this.prisma.approvalRequest.findUnique({
        where: {
          id: approvalRequestId,
        },
      }),
    ]);

    if (!parkingLot) {
      throw new BadRequestException(
        `Cloud parking lot not found: ${parkingLotId}`,
      );
    }

    if (!managerProfile) {
      throw new BadRequestException(
        `Cloud manager profile not found: ${requesterId}`,
      );
    }

    if (!edgeParkingLot) {
      throw new BadRequestException(
        `Edge node ${input.edgeNodeId} is not assigned to parking lot ${parkingLotId}`,
      );
    }

    if (approved) {
      return {
        action:
          'MANAGER_LOT_ACCESS_ALREADY_APPROVED',
        approvalRequestId,
        requesterId,
        parkingLotId,
        invoice: null,
      };
    }

    if (existingById) {
      if (
        existingById.requesterId !==
          requesterId ||
        existingById
          .requestedParkingLotId !==
          parkingLotId
      ) {
        throw new BadRequestException(
          `Approval request id conflict: ${approvalRequestId}`,
        );
      }

      return {
        action:
          existingById.status ===
          'PENDING'
            ? 'MANAGER_LOT_ACCESS_REQUEST_ALREADY_PENDING'
            : `MANAGER_LOT_ACCESS_REQUEST_ALREADY_${existingById.status}`,
        approvalRequestId:
          existingById.id,
        requesterId,
        parkingLotId,
        invoice: null,
      };
    }

    const duplicatePending =
      await this.prisma
        .approvalRequest.findFirst({
          where: {
            requesterId,
            requestedParkingLotId:
              parkingLotId,
            type: {
              in: [
                'MANAGER_LOT_ACCESS',
                'PARKING_LOT_ACCESS',
              ],
            },
            status: 'PENDING',
          },
        });

    if (duplicatePending) {
      const previousRequestData =
        this.asRecord(
          duplicatePending.requestData,
        );

      await this.prisma
        .approvalRequest.update({
          where: {
            id: duplicatePending.id,
          },
          data: {
            requestData: {
              ...previousRequestData,
              edgeApprovalRequestId:
                approvalRequestId,
              sourceEdgeNodeId:
                input.edgeNodeId,
              syncedFromEdge: true,
              syncedAt:
                new Date().toISOString(),
            } as any,
          },
        });

      return {
        action:
          'MANAGER_LOT_ACCESS_REQUEST_ALREADY_PENDING',
        approvalRequestId:
          duplicatePending.id,
        edgeApprovalRequestId:
          approvalRequestId,
        requesterId,
        parkingLotId,
        invoice: null,
      };
    }

    const memo =
      this.stringValue(
        input.payload.memo,
      );

    const item =
      await this.prisma
        .approvalRequest.create({
          data: {
            id: approvalRequestId,
            requesterId,
            managementCompanyId:
              parkingLot
                .managementCompanyId ??
              null,
            type:
              'MANAGER_LOT_ACCESS',
            status: 'PENDING',
            requestedParkingLotId:
              parkingLot.id,
            requestedParkingLotName:
              parkingLot.name,
            memo,
            requestData: {
              source: 'EDGE',
              sourceEdgeNodeId:
                input.edgeNodeId,
              edgeApprovalRequestId:
                approvalRequestId,
              requestedAt:
                this.stringValue(
                  input.payload.requestedAt,
                ) ?? null,
              syncedFromEdge: true,
              syncedAt:
                new Date().toISOString(),
            } as any,
          },
        });

    return {
      action:
        'MANAGER_LOT_ACCESS_REQUEST_CREATED_ON_CLOUD',
      approvalRequestId: item.id,
      requesterId,
      parkingLotId,
      invoice: null,
    };
  }

  private async applyEdgeParkingLotCreated(input: {
    edgeNodeId: string;
    event: EdgePushEvent;
    payload: Record<string, unknown>;
  }) {
    const nestedParkingLot = this.asRecord(input.payload.parkingLot);

    const payload =
      Object.keys(nestedParkingLot).length > 0
        ? nestedParkingLot
        : input.payload;

    const parkingLotId =
      this.stringValue(payload.id) ??
      this.stringValue(payload.parkingLotId) ??
      this.stringValue(input.event.aggregateId);

    const code = this.stringValue(payload.code);
    const name = this.stringValue(payload.name);
    const address = this.stringValue(payload.address);

    if (!parkingLotId) {
      throw new BadRequestException(
        "Edge parking lot creation requires parkingLot.id",
      );
    }

    if (!code) {
      throw new BadRequestException("Edge parking lot creation requires code");
    }

    if (!name) {
      throw new BadRequestException("Edge parking lot creation requires name");
    }

    if (!address) {
      throw new BadRequestException(
        "Edge parking lot creation requires address",
      );
    }

    const operationMode =
      payload.operationMode === "MANUAL"
        ? "MANUAL"
        : payload.operationMode === "SENSOR"
          ? "SENSOR"
          : null;

    if (!operationMode) {
      throw new BadRequestException(
        "Edge parking lot creation requires operationMode SENSOR or MANUAL",
      );
    }

    const requestedManagementCompanyId =
      this.stringValue(
        payload.managementCompanyId,
      );

    const createdByUserId =
      this.stringValue(
        input.payload.createdByUserId,
      );

    let managementCompanyId:
      string | null = null;

    if (requestedManagementCompanyId) {
      const requestedCompany =
        await this.prisma
          .managementCompany.findUnique({
            where: {
              id:
                requestedManagementCompanyId,
            },
            select: {
              id: true,
            },
          });

      managementCompanyId =
        requestedCompany?.id ?? null;
    }

    /*
     * Edge에서 전달한 관리회사 ID가 없거나
     * Cloud에 존재하지 않을 경우 등록자 계정으로
     * 한 번 더 관리회사를 해석한다.
     */
    if (
      !managementCompanyId &&
      createdByUserId
    ) {
      const [
        creatorUser,
        creatorManagerProfile,
      ] = await Promise.all([
        this.prisma.user.findUnique({
          where: {
            id: createdByUserId,
          },
          select: {
            managementCompanyId: true,
          },
        }),
        this.prisma.managerProfile.findUnique({
          where: {
            userId: createdByUserId,
          },
          select: {
            managementCompanyId: true,
          },
        }),
      ]);

      managementCompanyId =
        creatorManagerProfile
          ?.managementCompanyId ??
        creatorUser?.managementCompanyId ??
        null;
    }

    const [existingById, existingByCode] = await Promise.all([
      this.prisma.parkingLot.findUnique({
        where: {
          id: parkingLotId,
        },
      }),
      this.prisma.parkingLot.findUnique({
        where: {
          code,
        },
      }),
    ]);

    if (
      existingById &&
      existingByCode &&
      existingById.id !== existingByCode.id
    ) {
      throw new BadRequestException(
        `Parking lot id/code conflict: id=${parkingLotId}, code=${code}`,
      );
    }

    if (existingByCode && existingByCode.id !== parkingLotId) {
      throw new BadRequestException(
        `Parking lot code already belongs to another id: ${code}`,
      );
    }

    const sectionPayloads = Array.isArray(input.payload.sections)
      ? input.payload.sections.map((item) => this.asRecord(item))
      : [];

    const spacePayloads = Array.isArray(input.payload.spaces)
      ? input.payload.spaces.map((item) => this.asRecord(item))
      : [];

    const result = await this.prisma.$transaction(async (tx) => {
      const lotData = {
        code,
        name,
        region: this.stringValue(payload.region),
        district: this.stringValue(payload.district),
        address,
        timezone: this.stringValue(payload.timezone) ?? "Asia/Seoul",
        lat: this.numberValue(payload.lat),
        lng: this.numberValue(payload.lng),
        centerLat:
          this.numberValue(payload.centerLat) ?? this.numberValue(payload.lat),
        centerLng:
          this.numberValue(payload.centerLng) ?? this.numberValue(payload.lng),
        representative: this.stringValue(payload.representative),
        contact: this.stringValue(payload.contact),
        managementCompanyId,
        graceMinutes: this.numberValue(payload.graceMinutes) ?? 10,
        operationMode,
        isActive:
          typeof payload.isActive === "boolean" ? payload.isActive : true,
      };

      const existingLot = existingById ?? existingByCode;

      const parkingLot = existingLot
        ? await tx.parkingLot.update({
            where: {
              id: existingLot.id,
            },
            data: lotData,
          })
        : await tx.parkingLot.create({
            data: {
              id: parkingLotId,
              ...lotData,
            },
          });

      await ensureActiveParkingLotQr(tx, parkingLot);

      await tx.edgeParkingLot.upsert({
        where: {
          edgeNodeId_parkingLotId: {
            edgeNodeId: input.edgeNodeId,
            parkingLotId: parkingLot.id,
          },
        },
        update: {},
        create: {
          edgeNodeId: input.edgeNodeId,
          parkingLotId: parkingLot.id,
          isPrimary: false,
        },
      });

      let sectionCount = 0;
      let spaceCount = 0;

      for (const sectionPayload of sectionPayloads) {
        const sectionId = this.stringValue(sectionPayload.id);

        const sectionCode = this.stringValue(sectionPayload.code);

        const sectionName = this.stringValue(sectionPayload.name);

        if (!sectionId || !sectionName) {
          throw new BadRequestException(
            "Edge parking section requires id and name",
          );
        }

        const [existingSectionById, existingSectionByCode] = await Promise.all([
          tx.parkingSection.findUnique({
            where: {
              id: sectionId,
            },
          }),
          sectionCode
            ? tx.parkingSection.findUnique({
                where: {
                  parkingLotId_code: {
                    parkingLotId: parkingLot.id,
                    code: sectionCode,
                  },
                },
              })
            : Promise.resolve(null),
        ]);

        if (
          existingSectionById &&
          existingSectionById.parkingLotId !== parkingLot.id
        ) {
          throw new BadRequestException(
            `Parking section belongs to another lot: ${sectionId}`,
          );
        }

        if (existingSectionByCode && existingSectionByCode.id !== sectionId) {
          throw new BadRequestException(
            `Parking section code conflict: ${sectionCode}`,
          );
        }

        const sectionData = {
          parkingLotId: parkingLot.id,
          name: sectionName,
          code: sectionCode,
          centerLat: this.numberValue(sectionPayload.centerLat),
          centerLng: this.numberValue(sectionPayload.centerLng),
          polygonJson: sectionPayload.polygonJson ?? undefined,
          isActive:
            typeof sectionPayload.isActive === "boolean"
              ? sectionPayload.isActive
              : true,
        };

        if (existingSectionById || existingSectionByCode) {
          const target = existingSectionById ?? existingSectionByCode;

          await tx.parkingSection.update({
            where: {
              id: target!.id,
            },
            data: sectionData as any,
          });
        } else {
          await tx.parkingSection.create({
            data: {
              id: sectionId,
              ...sectionData,
            } as any,
          });
        }

        sectionCount += 1;
      }

      for (const spacePayload of spacePayloads) {
        const spaceId = this.stringValue(spacePayload.id);

        const sectionId = this.stringValue(spacePayload.sectionId);

        const spaceCode = this.stringValue(spacePayload.code);

        if (!spaceId || !sectionId || !spaceCode) {
          throw new BadRequestException(
            "Edge parking space requires id, sectionId and code",
          );
        }

        const section = await tx.parkingSection.findUnique({
          where: {
            id: sectionId,
          },
        });

        if (!section || section.parkingLotId !== parkingLot.id) {
          throw new BadRequestException(
            `Parking section not found for space: ${sectionId}`,
          );
        }

        const [existingSpaceById, existingSpaceByCode] = await Promise.all([
          tx.parkingSpace.findUnique({
            where: {
              id: spaceId,
            },
          }),
          tx.parkingSpace.findUnique({
            where: {
              sectionId_code: {
                sectionId,
                code: spaceCode,
              },
            },
          }),
        ]);

        if (existingSpaceById && existingSpaceById.sectionId !== sectionId) {
          throw new BadRequestException(
            `Parking space belongs to another section: ${spaceId}`,
          );
        }

        if (existingSpaceByCode && existingSpaceByCode.id !== spaceId) {
          throw new BadRequestException(
            `Parking space code conflict: ${spaceCode}`,
          );
        }

        const spaceType =
          this.stringValue(spacePayload.type) ??
          this.stringValue(spacePayload.spaceType) ??
          "REGULAR";

        const spaceStatus =
          this.stringValue(spacePayload.status) ??
          this.stringValue(spacePayload.spaceStatus) ??
          "EMPTY";

        const spaceData = {
          sectionId,
          code: spaceCode,
          number:
            this.stringValue(spacePayload.number) ??
            this.stringValue(spacePayload.spaceNumber),
          type: spaceType,
          status: spaceStatus,
          lat: this.numberValue(spacePayload.lat),
          lng: this.numberValue(spacePayload.lng),
          widthMeter: this.numberValue(spacePayload.widthMeter),
          heightMeter: this.numberValue(spacePayload.heightMeter),
          rotationDeg: this.numberValue(spacePayload.rotationDeg),
          posX: this.numberValue(spacePayload.posX),
          posY: this.numberValue(spacePayload.posY),
          polygonJson: spacePayload.polygonJson ?? undefined,
          isActive:
            typeof spacePayload.isActive === "boolean"
              ? spacePayload.isActive
              : false,
        };

        if (existingSpaceById || existingSpaceByCode) {
          const target = existingSpaceById ?? existingSpaceByCode;

          await tx.parkingSpace.update({
            where: {
              id: target!.id,
            },
            data: spaceData as any,
          });
        } else {
          await tx.parkingSpace.create({
            data: {
              id: spaceId,
              ...spaceData,
            } as any,
          });
        }

        spaceCount += 1;
      }

      return {
        parkingLot,
        sectionCount,
        spaceCount,
        wasCreated: !existingLot,
      };
    });

    return {
      action: result.wasCreated
        ? "EDGE_PARKING_LOT_CREATED_ON_CLOUD"
        : "EDGE_PARKING_LOT_UPDATED_ON_CLOUD",
      parkingLotId: result.parkingLot.id,
      code: result.parkingLot.code,
      edgeNodeId: input.edgeNodeId,
      sectionCount: result.sectionCount,
      spaceCount: result.spaceCount,
      invoice: null,
    };
  }

  private async applyEdgeParkingSessionEvent(input: {
    edgeNodeId: string;
    event: EdgePushEvent;
    payload: Record<string, unknown>;
  }) {
    const payload = input.payload;

    const isEntry =
      input.event.eventType ===
      'PARKING_SESSION_ENTERED_FROM_EDGE';

    const sessionId =
      this.stringValue(
        payload.sessionId,
      );

    const sessionNo =
      this.stringValue(
        payload.sessionNo,
      );

    const parkingLotId =
      this.stringValue(
        payload.parkingLotId,
      );

    const parkingSpaceId =
      this.stringValue(
        payload.parkingSpaceId,
      );

    if (!sessionId || !sessionNo) {
      throw new BadRequestException(
        'Edge parking-session event requires sessionId and sessionNo',
      );
    }

    if (!parkingLotId) {
      throw new BadRequestException(
        'Edge parking-session event requires parkingLotId',
      );
    }

    if (!parkingSpaceId) {
      throw new BadRequestException(
        'Edge parking-session event requires parkingSpaceId',
      );
    }

    const edgeParkingLot =
      await this.prisma
        .edgeParkingLot.findFirst({
          where: {
            edgeNodeId:
              input.edgeNodeId,
            parkingLotId,
          },
          select: {
            id: true,
          },
        });

    if (!edgeParkingLot) {
      throw new BadRequestException(
        `Edge node ${input.edgeNodeId} is not assigned to parking lot ${parkingLotId}`,
      );
    }

    const parkingSpace =
      await this.prisma
        .parkingSpace.findUnique({
          where: {
            id: parkingSpaceId,
          },
          include: {
            section: true,
          },
        });

    if (!parkingSpace) {
      throw new BadRequestException(
        `Cloud parking space not found: ${parkingSpaceId}`,
      );
    }

    if (
      parkingSpace.section
        .parkingLotId !==
      parkingLotId
    ) {
      throw new BadRequestException(
        `Parking space ${parkingSpaceId} does not belong to parking lot ${parkingLotId}`,
      );
    }

    let existing =
      await this.prisma
        .parkingSession.findUnique({
          where: {
            id: sessionId,
          },
          include: {
            ParkingSpace: {
              include: {
                section: true,
              },
            },
          },
        });

    if (!existing) {
      existing =
        await this.prisma
          .parkingSession.findFirst({
            where: {
              sessionNo,
            },
            include: {
              ParkingSpace: {
                include: {
                  section: true,
                },
              },
            },
          });
    }

    if (
      existing?.ParkingSpace &&
      existing.ParkingSpace.section
        .parkingLotId !==
        parkingLotId
    ) {
      throw new BadRequestException(
        `Cloud session ${existing.id} belongs to a different parking lot`,
      );
    }

    const occurredAt =
      this.resolveOccurredAt(
        this.stringValue(
          payload.occurredAt,
        ) ??
        input.event.occurredAt,
      );

    const existingMetadata =
      this.asRecord(
        existing?.metadata,
      );

    const lastEventAtText =
      this.stringValue(
        existingMetadata
          .edgeLastSessionEventAt,
      );

    if (lastEventAtText) {
      const lastEventAt =
        new Date(lastEventAtText);

      if (
        !Number.isNaN(
          lastEventAt.getTime(),
        ) &&
        lastEventAt.getTime() >
          occurredAt.getTime()
      ) {
        return {
          action:
            'EDGE_SESSION_STALE_EVENT_IGNORED',
          sessionId:
            existing?.id ??
            sessionId,
          sessionNo,
          eventType:
            input.event.eventType,
          invoice: null,
        };
      }
    }

    const parseOptionalDate = (
      value: unknown,
    ): Date | null => {
      const text =
        this.stringValue(value);

      if (!text) {
        return null;
      }

      const parsed =
        new Date(text);

      if (
        Number.isNaN(
          parsed.getTime(),
        )
      ) {
        throw new BadRequestException(
          `Invalid session date: ${text}`,
        );
      }

      return parsed;
    };

    const integerValue = (
      value: unknown,
    ): number | null => {
      const normalized =
        this.numberValue(value);

      if (
        normalized === null ||
        !Number.isFinite(normalized)
      ) {
        return null;
      }

      return Math.round(normalized);
    };

    const totalMinutes =
      integerValue(
        payload.totalMinutes,
      );

    const entryTimeFromPayload =
      parseOptionalDate(
        payload.entryTime,
      );

    const exitTimeFromPayload =
      parseOptionalDate(
        payload.exitTime,
      );

    const exitTime =
      isEntry
        ? null
        : exitTimeFromPayload ??
          occurredAt;

    const entryTime =
      entryTimeFromPayload ??
      existing?.entryTime ??
      (
        !isEntry &&
        exitTime &&
        totalMinutes !== null
          ? new Date(
              exitTime.getTime() -
              totalMinutes * 60000,
            )
          : occurredAt
      );

    const incomingMetadata =
      this.asRecord(
        payload.metadata,
      );

    const sessionStatus =
      this.stringValue(
        payload.sessionStatus,
      );

    const nextStatus =
      isEntry
        ? 'ACTIVE'
        : sessionStatus === 'PAID'
          ? 'PAID'
          : 'CLOSED';

    const amount =
      integerValue(payload.amount);

    const paidAmount =
      integerValue(
        payload.paidAmount,
      );

    const unpaidAmount =
      integerValue(
        payload.unpaidAmount,
      );

    const isRegistered =
      typeof payload.isRegistered ===
      'boolean'
        ? payload.isRegistered
        : existing?.isRegistered ??
          false;

    const metadata = {
      ...existingMetadata,
      ...incomingMetadata,
      source:
        'EDGE_SYNC',
      edgeNodeId:
        input.edgeNodeId,
      edgeSessionId:
        sessionId,
      edgeSessionNo:
        sessionNo,
      syncedFromEdge:
        true,
      syncedFromEdgeAt:
        new Date().toISOString(),
      edgeLastSessionEventType:
        input.event.eventType,
      edgeLastSessionEventAt:
        occurredAt.toISOString(),
      edgeUserId:
        this.stringValue(
          payload.edgeUserId,
        ),
      edgeVehicleId:
        this.stringValue(
          payload.edgeVehicleId,
        ),
      sensorDeviceId:
        this.stringValue(
          payload.sensorDeviceId,
        ),
      devEui:
        this.stringValue(
          payload.devEui,
        ),
      paymentRequired:
        typeof payload
          .paymentRequired ===
        'boolean'
          ? payload.paymentRequired
          : unpaidAmount !== null
            ? unpaidAmount > 0
            : false,
      invoiceId:
        this.stringValue(
          payload.invoiceId,
        ),
      invoiceNo:
        this.stringValue(
          payload.invoiceNo,
        ),
      invoiceStatus:
        this.stringValue(
          payload.invoiceStatus,
        ),
      feeCalculation:
        payload.feeCalculation ??
        null,
    };

    const eventData = {
      type:
        isEntry
          ? 'EDGE_SESSION_ENTRY_SYNCED'
          : 'EDGE_SESSION_EXIT_SYNCED',
      source:
        'EDGE_SYNC',
      payload: {
        edgeNodeId:
          input.edgeNodeId,
        edgeEventId:
          input.event.eventId ??
          null,
        edgeEventType:
          input.event.eventType,
        occurredAt:
          occurredAt.toISOString(),
        parkingLotId,
        parkingSpaceId,
      } as any,
    };

    const result =
      await this.prisma
        .$transaction(async (tx) => {
          let saved;

          if (existing) {
            saved =
              await tx.parkingSession
                .update({
                  where: {
                    id: existing.id,
                  },
                  data: {
                    parkingSpaceId,
                    plateNumber:
                      this.stringValue(
                        payload.plateNumber,
                      ) ??
                      existing.plateNumber,
                    status:
                      nextStatus as any,
                    entrySource:
                      this.stringValue(
                        payload.entrySource,
                      ) ??
                      existing.entrySource ??
                      'SENSOR',
                    exitSource:
                      isEntry
                        ? existing.exitSource
                        : this.stringValue(
                            payload.exitSource,
                          ) ??
                          'SENSOR',
                    entryTime,
                    exitTime:
                      isEntry
                        ? existing.exitTime
                        : exitTime,
                    billingClosedAt:
                      isEntry
                        ? existing
                            .billingClosedAt
                        : parseOptionalDate(
                            payload
                              .billingClosedAt,
                          ) ??
                          exitTime,
                    totalMinutes:
                      totalMinutes ??
                      existing.totalMinutes,
                    amount:
                      amount ??
                      existing.amount,
                    paidAmount:
                      paidAmount ??
                      existing.paidAmount,
                    unpaidAmount:
                      unpaidAmount ??
                      existing.unpaidAmount,
                    isRegistered,
                    metadata:
                      metadata as any,
                    events: {
                      create:
                        eventData,
                    },
                  },
                });
          } else {
            saved =
              await tx.parkingSession
                .create({
                  data: {
                    id: sessionId,
                    sessionNo,
                    parkingSpaceId,
                    plateNumber:
                      this.stringValue(
                        payload.plateNumber,
                      ),
                    sessionType:
                      'HOURLY' as any,
                    status:
                      nextStatus as any,
                    entrySource:
                      this.stringValue(
                        payload.entrySource,
                      ) ??
                      'SENSOR',
                    exitSource:
                      isEntry
                        ? null
                        : this.stringValue(
                            payload.exitSource,
                          ) ??
                          'SENSOR',
                    entryTime,
                    exitTime,
                    billingClosedAt:
                      isEntry
                        ? null
                        : parseOptionalDate(
                            payload
                              .billingClosedAt,
                          ) ??
                          exitTime,
                    totalMinutes,
                    amount,
                    paidAmount,
                    unpaidAmount,
                    isRegistered,
                    metadata:
                      metadata as any,
                    events: {
                      create:
                        eventData,
                    },
                  } as any,
                });
          }

          await tx.parkingSpace.update({
            where: {
              id: parkingSpaceId,
            },
            data: {
              status:
                (
                  isEntry
                    ? 'OCCUPIED'
                    : 'EMPTY'
                ) as any,
            },
          });

          return saved;
        });

    return {
      action:
        isEntry
          ? 'EDGE_PARKING_SESSION_ENTERED_APPLIED'
          : 'EDGE_PARKING_SESSION_EXITED_APPLIED',
      sessionId:
        result.id,
      sessionNo:
        result.sessionNo,
      status:
        result.status,
      parkingLotId,
      parkingSpaceId,
      invoice: null,
    };
  }

  private async applyEdgeSensorEvent(input: {
    edgeNodeId: string;
    event: EdgePushEvent;
    payload: Record<string, unknown>;
  }) {
    const payload = input.payload;

    const devEuiRaw =
      this.stringValue(
        payload.devEui,
      );

    const devEui =
      devEuiRaw
        ?.replace(/[\s:-]/g, '')
        .toUpperCase() ??
      null;

    if (!devEui) {
      throw new BadRequestException(
        'Edge sensor event requires devEui',
      );
    }

    const parkingLotId =
      this.stringValue(
        payload.parkingLotId,
      );

    if (!parkingLotId) {
      throw new BadRequestException(
        'Edge sensor event requires parkingLotId',
      );
    }

    const edgeParkingLot =
      await this.prisma
        .edgeParkingLot.findFirst({
          where: {
            edgeNodeId:
              input.edgeNodeId,
            parkingLotId,
          },
          select: {
            id: true,
          },
        });

    if (!edgeParkingLot) {
      throw new BadRequestException(
        `Edge node ${input.edgeNodeId} is not assigned to parking lot ${parkingLotId}`,
      );
    }

    const parkingSpaceId =
      this.stringValue(
        payload.parkingSpaceId,
      );

    const parkingSpace =
      parkingSpaceId
        ? await this.prisma
            .parkingSpace.findUnique({
              where: {
                id: parkingSpaceId,
              },
              include: {
                section: true,
              },
            })
        : null;

    if (
      parkingSpace &&
      parkingSpace.section
        .parkingLotId !==
        parkingLotId
    ) {
      throw new BadRequestException(
        `Parking space ${parkingSpace.id} does not belong to parking lot ${parkingLotId}`,
      );
    }

    if (
      input.event.eventType ===
        'PARKING_SPACE_STATUS_CHANGED_FROM_EDGE' &&
      !parkingSpace
    ) {
      throw new BadRequestException(
        `Cloud parking space not found: ${parkingSpaceId ?? 'null'}`,
      );
    }

    const sensorDeviceId =
      this.stringValue(
        payload.sensorDeviceId,
      );

    const includeSensorScope = {
      parkingSpace: {
        include: {
          section: true,
        },
      },
    };

    let sensor: any = null;

    if (sensorDeviceId) {
      sensor =
        await this.prisma
          .sensorDevice.findUnique({
            where: {
              id: sensorDeviceId,
            },
            include:
              includeSensorScope,
          });
    }

    const resolveSensorLotId = (
      value: any,
    ) =>
      value?.parkingLotId ??
      value?.parkingSpace
        ?.section?.parkingLotId ??
      null;

    if (
      sensor &&
      resolveSensorLotId(sensor) !==
        parkingLotId
    ) {
      sensor = null;
    }

    if (!sensor) {
      const byDevEui =
        await this.prisma
          .sensorDevice.findUnique({
            where: {
              devEui,
            },
            include:
              includeSensorScope,
          });

      if (
        byDevEui &&
        resolveSensorLotId(
          byDevEui,
        ) === parkingLotId
      ) {
        sensor = byDevEui;
      }
    }

    const occurredAt =
      this.resolveOccurredAt(
        this.stringValue(
          payload.occurredAt,
        ) ??
        input.event.occurredAt,
      );

    const integerValue = (
      value: unknown,
    ): number | null => {
      const normalized =
        this.numberValue(value);

      return normalized !== null &&
        Number.isInteger(normalized)
        ? normalized
        : null;
    };

    const parkingStatus =
      integerValue(
        payload.parkingStatus,
      );

    const deviceStatus =
      integerValue(
        payload.deviceStatus,
      );

    const batteryStatus =
      integerValue(
        payload.batteryStatus,
      );

    const firmwareVersion =
      integerValue(
        payload.firmwareVersion,
      );

    const batteryVoltage =
      this.numberValue(
        payload.batteryVoltage,
      );

    const rssi =
      integerValue(payload.rssi);

    const snr =
      this.numberValue(payload.snr);

    const channel =
      integerValue(
        payload.channel,
      );

    const fCnt =
      integerValue(payload.fCnt);

    const fPort =
      integerValue(payload.fPort);

    const dr =
      integerValue(payload.dr);

    const sourceEventType =
      this.stringValue(
        payload.sourceEventType,
      ) ??
      'parking.sensor.telemetry';

    const sensorEventLogId =
      this.stringValue(
        payload.sensorEventLogId,
      ) ??
      input.event.eventId ??
      randomUUID();

    const requestedStatus =
      this.stringValue(
        payload.status,
      );

    const spaceStatus =
      requestedStatus === 'EMPTY' ||
      requestedStatus === 'OCCUPIED'
        ? requestedStatus
        : null;

    if (
      input.event.eventType ===
        'PARKING_SPACE_STATUS_CHANGED_FROM_EDGE' &&
      !spaceStatus
    ) {
      throw new BadRequestException(
        'Edge parking-space status event requires EMPTY or OCCUPIED status',
      );
    }

    const result =
      await this.prisma
        .$transaction(async (tx) => {
          const logData = {
            devEui,
            deviceId:
              sensor?.id ?? null,
            parkingSpaceId:
              parkingSpace?.id ??
              null,
            source:
              `edge:${input.edgeNodeId}`,
            eventType:
              sourceEventType,
            parkingStatus,
            deviceStatus,
            batteryStatus,
            batteryVoltage,
            firmwareVersion,
            gatewayId:
              this.stringValue(
                payload.gatewayId,
              ),
            rssi,
            snr,
            channel,
            fCnt,
            fPort,
            dr,
            rawPayload:
              payload.rawPayload ===
              undefined
                ? undefined
                : payload
                    .rawPayload as any,
            parsedPayload:
              payload.parsedPayload ===
              undefined
                ? undefined
                : payload
                    .parsedPayload as any,
            occurredAt,
          };

          const sensorEventLog =
            await tx.sensorEventLog
              .upsert({
                where: {
                  id:
                    sensorEventLogId,
                },
                update:
                  logData as any,
                create: {
                  id:
                    sensorEventLogId,
                  ...logData,
                } as any,
              });

          if (sensor) {
            const metadata =
              this.asRecord(
                sensor.metadata,
              );

            const edgeTelemetry =
              this.asRecord(
                metadata.edgeTelemetry,
              );

            await tx.sensorDevice
              .update({
                where: {
                  id: sensor.id,
                },
                data: {
                  lastSeenAt:
                    occurredAt,
                  firmwareVersion:
                    firmwareVersion !==
                    null
                      ? String(
                          firmwareVersion,
                        )
                      : undefined,
                  metadata: {
                    ...metadata,
                    edgeTelemetry: {
                      ...edgeTelemetry,
                      edgeNodeId:
                        input.edgeNodeId,
                      edgeEventId:
                        input.event
                          .eventId ??
                        null,
                      parkingStatus,
                      deviceStatus,
                      batteryStatus,
                      batteryVoltage,
                      gatewayId:
                        this.stringValue(
                          payload.gatewayId,
                        ),
                      rssi,
                      snr,
                      channel,
                      fCnt,
                      fPort,
                      dr,
                      occurredAt:
                        occurredAt
                          .toISOString(),
                    },
                  } as any,
                },
              });
          }

          if (
            parkingSpace &&
            spaceStatus
          ) {
            await tx.parkingSpace
              .update({
                where: {
                  id:
                    parkingSpace.id,
                },
                data: {
                  status:
                    spaceStatus as any,
                },
              });
          }

          return {
            sensorEventLogId:
              sensorEventLog.id,
            sensorId:
              sensor?.id ?? null,
            parkingSpaceId:
              parkingSpace?.id ??
              null,
          };
        });

    return {
      action:
        input.event.eventType ===
        'PARKING_SPACE_STATUS_CHANGED_FROM_EDGE'
          ? 'EDGE_PARKING_SPACE_STATUS_APPLIED'
          : 'EDGE_SENSOR_TELEMETRY_APPLIED',
      edgeNodeId:
        input.edgeNodeId,
      parkingLotId,
      parkingSectionId:
        this.stringValue(
          payload.parkingSectionId,
        ),
      devEui,
      sensorMatched:
        Boolean(sensor),
      status:
        spaceStatus,
      ...result,
      invoice: null,
    };
  }

  private async applyDisplayBoardConfigurationFromCloud(
    edgeNodeId: string,
    message: ResolvedCloudMessage,
  ) {
    const payload =
      message.payload;

    const boardPayload =
      this.asRecord(
        payload.board,
      );

    const displayBoardId =
      this.stringValue(
        payload.displayBoardId,
      ) ??
      this.stringValue(
        boardPayload.id,
      );

    const parkingLotId =
      this.stringValue(
        payload.parkingLotId,
      ) ??
      this.stringValue(
        boardPayload.parkingLotId,
      );

    const code =
      this.stringValue(
        boardPayload.code,
      );

    const name =
      this.stringValue(
        boardPayload.name,
      );

    if (
      !displayBoardId ||
      !parkingLotId ||
      !code ||
      !name
    ) {
      throw new BadRequestException(
        'Display configuration requires displayBoardId, parkingLotId, code and name',
      );
    }

    const parkingLot =
      await this.prisma.parkingLot.findUnique({
        where: {
          id:
            parkingLotId,
        },
        select: {
          id: true,
        },
      });

    if (!parkingLot) {
      throw new BadRequestException(
        `Edge parking lot not found: ${parkingLotId}`,
      );
    }

    const lines =
      Array.isArray(
        payload.lines,
      )
        ? payload.lines.filter(
            (
              value,
            ): value is Record<
              string,
              unknown
            > =>
              Boolean(
                value &&
                typeof value ===
                  'object' &&
                !Array.isArray(
                  value,
                ),
              ),
          )
        : [];

    const modules =
      Array.isArray(
        payload.modules,
      )
        ? payload.modules.filter(
            (
              value,
            ): value is Record<
              string,
              unknown
            > =>
              Boolean(
                value &&
                typeof value ===
                  'object' &&
                !Array.isArray(
                  value,
                ),
              ),
          )
        : [];

    const sectionIds =
      Array.from(
        new Set(
          modules
            .map(
              (module) =>
                this.stringValue(
                  module.parkingSectionId,
                ),
            )
            .filter(
              (
                value,
              ): value is string =>
                Boolean(value),
            ),
        ),
      );

    const existingSections =
      sectionIds.length > 0
        ? await this.prisma.parkingSection
            .findMany({
              where: {
                id: {
                  in:
                    sectionIds,
                },
                parkingLotId,
              },
              select: {
                id: true,
              },
            })
        : [];

    const validSectionIds =
      new Set(
        existingSections.map(
          (section) =>
            section.id,
        ),
      );

    const nullableNumber = (
      value: unknown,
    ) => {
      const parsed =
        this.numberValue(
          value,
        );

      return parsed === null
        ? null
        : parsed;
    };

    const nullableString = (
      value: unknown,
    ) =>
      this.stringValue(
        value,
      );

    const nullableDate = (
      value: unknown,
    ) => {
      const raw =
        this.stringValue(
          value,
        );

      if (!raw) {
        return null;
      }

      const parsed =
        new Date(raw);

      return Number.isNaN(
        parsed.getTime(),
      )
        ? null
        : parsed;
    };

    const boardData = {
      parkingLotId,
      code,
      name,

      deviceId:
        nullableString(
          boardPayload.deviceId,
        ),
      macAddress:
        nullableString(
          boardPayload.macAddress,
        ),

      enabled:
        typeof boardPayload.enabled ===
          'boolean'
          ? boardPayload.enabled
          : true,

      transport:
        nullableString(
          boardPayload.transport,
        ) ??
        'TCP',

      tcpHost:
        nullableString(
          boardPayload.tcpHost,
        ),
      tcpPort:
        nullableNumber(
          boardPayload.tcpPort,
        ),

      serialPort:
        nullableString(
          boardPayload.serialPort,
        ),
      baudRate:
        nullableNumber(
          boardPayload.baudRate,
        ),
      dataBits:
        nullableNumber(
          boardPayload.dataBits,
        ),
      parity:
        nullableString(
          boardPayload.parity,
        ),
      stopBits:
        nullableNumber(
          boardPayload.stopBits,
        ),

      connectTimeoutMs:
        nullableNumber(
          boardPayload.connectTimeoutMs,
        ),
      readTimeoutMs:
        nullableNumber(
          boardPayload.readTimeoutMs,
        ),

      rows:
        nullableNumber(
          boardPayload.rows,
        ) ??
        1,
      cols:
        nullableNumber(
          boardPayload.cols,
        ) ??
        4,

      moduleType:
        nullableString(
          boardPayload.moduleType,
        ),
      rgbOrder:
        nullableString(
          boardPayload.rgbOrder,
        ),

      brightness:
        nullableNumber(
          boardPayload.brightness,
        ),

      powerOn:
        typeof boardPayload.powerOn ===
          'boolean'
          ? boardPayload.powerOn
          : true,

      heartbeatIntervalSec:
        nullableNumber(
          boardPayload.heartbeatIntervalSec,
        ),
      retryMaxAttempts:
        nullableNumber(
          boardPayload.retryMaxAttempts,
        ),
      retryBackoffMs:
        nullableNumber(
          boardPayload.retryBackoffMs,
        ),

      mode:
        nullableString(
          boardPayload.mode,
        ) ??
        'AUTO',

      manualReason:
        nullableString(
          boardPayload.manualReason,
        ),
      manualExpiresAt:
        nullableDate(
          boardPayload.manualExpiresAt,
        ),
    };

    await this.prisma.$transaction(
      async (tx) => {
        await tx.displayBoard.upsert({
          where: {
            id:
              displayBoardId,
          },
          create: {
            id:
              displayBoardId,
            ...boardData,
          } as any,
          update:
            boardData as any,
        });

        await tx.displayBoardLine.deleteMany({
          where: {
            displayBoardId,
          },
        });

        if (lines.length > 0) {
          await tx.displayBoardLine.createMany({
            data:
              lines.map(
                (line) => ({
                  displayBoardId,

                  source:
                    this.stringValue(
                      line.source,
                    ) ??
                    'AUTO',

                  lineNo:
                    this.numberValue(
                      line.lineNo,
                    ) ??
                    1,

                  textTemplate:
                    this.stringValue(
                      line.textTemplate,
                    ) ??
                    '',

                  enabled:
                    typeof line.enabled ===
                      'boolean'
                      ? line.enabled
                      : true,

                  fontSize:
                    this.numberValue(
                      line.fontSize,
                    ) ??
                    1,

                  effect:
                    this.stringValue(
                      line.effect,
                    ) ??
                    '090009000900',

                  speed:
                    this.numberValue(
                      line.speed,
                    ) ??
                    2,

                  delay:
                    this.numberValue(
                      line.delay,
                    ) ??
                    5,

                  neon:
                    this.numberValue(
                      line.neon,
                    ) ??
                    0,

                  fix:
                    typeof line.fix ===
                      'boolean'
                      ? line.fix
                      : false,

                  colorCode:
                    this.numberValue(
                      line.colorCode,
                    ) ??
                    0,

                  fontCode:
                    this.numberValue(
                      line.fontCode,
                    ) ??
                    0,

                  widthCode:
                    this.numberValue(
                      line.widthCode,
                    ) ??
                    1,

                  attributeCode:
                    this.numberValue(
                      line.attributeCode,
                    ) ??
                    0,

                  iconCode:
                    this.stringValue(
                      line.iconCode,
                    ),
                })) as any,
          });
        }

        await tx.displayBoardModule.deleteMany({
          where: {
            displayBoardId,
          },
        });

        if (modules.length > 0) {
          await tx.displayBoardModule.createMany({
            data:
              modules.map(
                (module) => {
                  const sectionId =
                    this.stringValue(
                      module.parkingSectionId,
                    );

                  return {
                    displayBoardId,

                    rowNo:
                      this.numberValue(
                        module.rowNo,
                      ) ??
                      1,

                    colNo:
                      this.numberValue(
                        module.colNo,
                      ) ??
                      1,

                    parkingSectionId:
                      sectionId &&
                      validSectionIds.has(
                        sectionId,
                      )
                        ? sectionId
                        : null,

                    label:
                      this.stringValue(
                        module.label,
                      ),

                    enabled:
                      typeof module.enabled ===
                        'boolean'
                        ? module.enabled
                        : true,

                    charWidth:
                      this.numberValue(
                        module.charWidth,
                      ) ??
                      4,

                    padChar:
                      (
                        this.stringValue(
                          module.padChar,
                        ) ??
                        ' '
                      ).slice(
                        0,
                        1,
                      ),
                  };
                },
              ) as any,
          });
        }
      },
    );

    return {
      ok: true,
      applied: true,
      action:
        'DISPLAY_BOARD_CONFIGURATION_APPLIED_FROM_CLOUD',
      edgeNodeId,
      cursor:
        message.cursor,
      outboxId:
        message.outboxId,
      eventType:
        message.eventType,

      sessionId:
        displayBoardId,
      sessionNo:
        code,
      invoice:
        null,

      displayBoardId,
      parkingLotId,
      lineCount:
        lines.length,
      moduleCount:
        modules.length,
    };
  }

  private async applyDisplayCommandFromCloud(
    edgeNodeId: string,
    message: ResolvedCloudMessage,
  ) {
    const payload =
      message.payload;

    const cloudCommandId =
      this.stringValue(
        payload.cloudCommandId,
      );

    const displayBoardId =
      this.stringValue(
        payload.displayBoardId,
      );

    const type =
      this.stringValue(
        payload.type,
      );

    if (
      !cloudCommandId ||
      !displayBoardId ||
      !type
    ) {
      throw new BadRequestException(
        'Display command requires cloudCommandId, displayBoardId and type',
      );
    }

    const board =
      await this.prisma.displayBoard.findUnique({
        where: {
          id:
            displayBoardId,
        },
      });

    if (!board) {
      throw new BadRequestException(
        `Edge display board not found: ${displayBoardId}`,
      );
    }

    const existing =
      await this.prisma.displayCommand.findUnique({
        where: {
          id:
            cloudCommandId,
        },
      });

    if (existing) {
      return {
        ok: true,
        applied: false,
        action:
          'DISPLAY_COMMAND_ALREADY_APPLIED_FROM_CLOUD',
        edgeNodeId,
        cursor:
          message.cursor,
        outboxId:
          message.outboxId,
        eventType:
          message.eventType,

        sessionId:
          displayBoardId,
        sessionNo:
          type,
        invoice:
          null,

        displayBoardId,
        cloudCommandId,
        edgeCommandId:
          existing.id,
      };
    }

    const rawCommandPayload =
      this.asRecord(
        payload.commandPayload,
      );

    const commandPayload = {
      ...rawCommandPayload,
      cloudCommandId,
      cloudEdgeNodeId:
        edgeNodeId,
      cloudRequestedAt:
        this.stringValue(
          payload.requestedAt,
        ) ??
        null,
    };

    const requestedAtRaw =
      this.stringValue(
        payload.requestedAt,
      );

    const requestedAt =
      requestedAtRaw
        ? new Date(
            requestedAtRaw,
          )
        : new Date();

    const validRequestedAt =
      Number.isNaN(
        requestedAt.getTime(),
      )
        ? new Date()
        : requestedAt;

    const edgeCommand =
      await this.prisma.$transaction(
        async (tx) => {
          const boardUpdate:
            Record<
              string,
              unknown
            > = {};

          if (
            type ===
            'BRIGHTNESS'
          ) {
            const brightness =
              this.numberValue(
                rawCommandPayload.brightness,
              );

            if (
              brightness !==
              null
            ) {
              boardUpdate.brightness =
                brightness;
            }
          }

          if (
            type ===
              'POWER' &&
            typeof rawCommandPayload.powerOn ===
              'boolean'
          ) {
            boardUpdate.powerOn =
              rawCommandPayload.powerOn;
          }

          if (
            Object.keys(
              boardUpdate,
            ).length > 0
          ) {
            await tx.displayBoard.update({
              where: {
                id:
                  displayBoardId,
              },
              data:
                boardUpdate as any,
            });
          }

          return tx.displayCommand.create({
            data: {
              id:
                cloudCommandId,
              displayBoardId,
              type,
              payload:
                commandPayload as any,
              status:
                'PENDING' as any,
              requestedAt:
                validRequestedAt,
            } as any,
          });
        },
      );

    return {
      ok: true,
      applied: true,
      action:
        'DISPLAY_COMMAND_APPLIED_FROM_CLOUD',
      edgeNodeId,
      cursor:
        message.cursor,
      outboxId:
        message.outboxId,
      eventType:
        message.eventType,

      sessionId:
        displayBoardId,
      sessionNo:
        type,
      invoice:
        null,

      displayBoardId,
      cloudCommandId,
      edgeCommandId:
        edgeCommand.id,
      commandStatus:
        edgeCommand.status,
    };
  }

  private async applyEdgeDisplayCommandResult(input: {
    edgeNodeId: string;
    event: EdgePushEvent;
    payload: Record<string, unknown>;
  }) {
    const cloudCommandId =
      this.stringValue(
        input.payload.cloudCommandId,
      );

    if (!cloudCommandId) {
      throw new BadRequestException(
        'Display result requires cloudCommandId',
      );
    }

    const command =
      await this.prisma.displayCommand.findUnique({
        where: {
          id:
            cloudCommandId,
        },
      });

    if (!command) {
      throw new BadRequestException(
        `Cloud display command not found: ${cloudCommandId}`,
      );
    }

    const status =
      this.stringValue(
        input.payload.status,
      ) ??
      'FAILED';

    const parseDate = (
      value: unknown,
    ) => {
      const raw =
        this.stringValue(
          value,
        );

      if (!raw) {
        return null;
      }

      const parsed =
        new Date(raw);

      return Number.isNaN(
        parsed.getTime(),
      )
        ? null
        : parsed;
    };

    const updated =
      await this.prisma.displayCommand.update({
        where: {
          id:
            command.id,
        },
        data: {
          status:
            status as any,
          packetHex:
            this.stringValue(
              input.payload.packetHex,
            ),
          responseHex:
            this.stringValue(
              input.payload.responseHex,
            ),
          errorMessage:
            this.stringValue(
              input.payload.errorMessage,
            ) ??
            '',
          attempts:
            this.numberValue(
              input.payload.attempts,
            ) ??
            command.attempts,
          processingAt:
            parseDate(
              input.payload.processingAt,
            ) ??
            command.processingAt,
          sentAt:
            parseDate(
              input.payload.sentAt,
            ) ??
            command.sentAt,
          ackedAt:
            parseDate(
              input.payload.ackedAt,
            ) ??
            command.ackedAt,
          failedAt:
            parseDate(
              input.payload.failedAt,
            ) ??
            command.failedAt,
        },
      });

    if (
      status ===
      'ACKED'
    ) {
      await this.prisma.displayBoard.update({
        where: {
          id:
            command.displayBoardId,
        },
        data: {
          lastStatus:
            'OK' as any,
          lastError:
            null,
          lastSentAt:
            updated.sentAt ??
            new Date(),
          lastAckAt:
            updated.ackedAt ??
            new Date(),
          lastSentPayload:
            command.payload as any,
          lastResponseHex:
            updated.responseHex,
        },
      });
    }

    if (
      status ===
      'FAILED'
    ) {
      await this.prisma.displayBoard.update({
        where: {
          id:
            command.displayBoardId,
        },
        data: {
          lastStatus:
            'ERROR' as any,
          lastError:
            updated.errorMessage ??
            'Display command failed',
          lastSentAt:
            updated.sentAt ??
            new Date(),
          lastResponseHex:
            updated.responseHex,
        },
      });
    }

    return {
      action:
        'EDGE_DISPLAY_COMMAND_RESULT_APPLIED',
      sessionId:
        command.displayBoardId,
      sessionNo:
        command.type,
      invoice:
        null,

      edgeNodeId:
        input.edgeNodeId,
      cloudCommandId:
        command.id,
      displayBoardId:
        command.displayBoardId,
      commandStatus:
        updated.status,
    };
  }

  private async createCloudInvoiceForEdgePaidExit(input: {
    edgeNodeId: string;
    event: EdgePushEvent;
    payload: Record<string, unknown>;
    cloudSessionId: string;
  }) {
    const edgeInvoice =
      this.asRecord(
        input.payload.edgeInvoice,
      );

    const incomingMetadata =
      this.asRecord(
        input.payload.metadata,
      );

    const session =
      await this.prisma
        .parkingSession.findUnique({
          where: {
            id:
              input.cloudSessionId,
          },
        });

    if (!session) {
      throw new BadRequestException(
        `Cloud parking session not found: ${input.cloudSessionId}`,
      );
    }

    const occurredAt =
      this.resolveOccurredAt(
        this.stringValue(
          input.payload.exitTime,
        ) ??
        this.stringValue(
          input.payload.occurredAt,
        ) ??
        input.event.occurredAt,
      );

    const edgeInvoiceId =
      this.stringValue(
        edgeInvoice.id,
      ) ??
      this.stringValue(
        input.payload.invoiceId,
      );

    const edgeInvoiceNo =
      this.stringValue(
        edgeInvoice.invoiceNo,
      ) ??
      this.stringValue(
        input.payload.invoiceNo,
      );

    const edgeInvoiceStatus =
      this.stringValue(
        edgeInvoice.status,
      ) ??
      this.stringValue(
        input.payload.invoiceStatus,
      ) ??
      'PAID';

    const edgeInvoiceAmount =
      Math.max(
        0,
        Math.round(
          this.numberValue(
            edgeInvoice.amount,
          ) ??
          this.numberValue(
            input.payload.amount,
          ) ??
          0,
        ),
      );

    const edgeInvoicePaidAmount =
      Math.max(
        0,
        Math.round(
          this.numberValue(
            edgeInvoice.paidAmount,
          ) ??
          this.numberValue(
            input.payload.paidAmount,
          ) ??
          edgeInvoiceAmount,
        ),
      );

    const edgeInvoiceUnpaidAmount =
      Math.max(
        0,
        Math.round(
          this.numberValue(
            edgeInvoice.unpaidAmount,
          ) ??
          this.numberValue(
            input.payload.unpaidAmount,
          ) ??
          0,
        ),
      );

    const paymentMethod =
      this.stringValue(
        incomingMetadata
          .manualExitPaymentMethod,
      ) ??
      this.stringValue(
        incomingMetadata
          .paymentMethod,
      ) ??
      'EDGE_REPORTED';

    const providerReference =
      this.stringValue(
        input.event.eventId,
      ) ??
      [
        'EDGE-PAID-EXIT',
        input.edgeNodeId,
        session.id,
        occurredAt.toISOString(),
      ].join(':');

    /*
     * Cloud 정책을 기준으로 공식 Invoice를 생성한다.
     * Edge Invoice는 별도 namespace의 감사 스냅샷으로 보존한다.
     */
    const ensured =
      await this.invoicesService
        .ensureInvoiceForSession({
          sessionId:
            session.id,
          now:
            occurredAt,
          forceRecalculate:
            true,
        });

    const transactionResult =
      await this.prisma.$transaction(
        async (tx) => {
          const currentInvoice =
            await tx.invoice
              .findUnique({
                where: {
                  id:
                    ensured.invoice.id,
                },
              });

          if (!currentInvoice) {
            throw new BadRequestException(
              `Cloud Invoice not found after creation: ${ensured.invoice.id}`,
            );
          }

          const existingPaymentTransaction =
            await (tx as any)
              .paymentTransaction
              .findFirst({
                where: {
                  provider:
                    'EDGE_PAYMENT_SYNC',
                  providerReference,
                  parkingSessionId:
                    session.id,
                },
              });

          const targetPaidAmount =
            Math.min(
              currentInvoice.amount,
              edgeInvoicePaidAmount,
            );

          const paymentDelta =
            existingPaymentTransaction
              ? 0
              : Math.max(
                  0,
                  targetPaidAmount -
                    currentInvoice.paidAmount,
                );

          const nextPaidAmount =
            Math.min(
              currentInvoice.amount,
              currentInvoice.paidAmount +
                paymentDelta,
            );

          const nextUnpaidAmount =
            Math.max(
              0,
              currentInvoice.amount -
                nextPaidAmount,
            );

          const nextInvoiceStatus =
            nextUnpaidAmount <= 0
              ? 'PAID'
              : nextPaidAmount > 0
                ? 'PARTIALLY_PAID'
                : 'ISSUED';

          const currentInvoiceMetadata =
            this.asRecord(
              currentInvoice.metadata,
            );

          const updatedInvoice =
            await tx.invoice.update({
              where: {
                id:
                  currentInvoice.id,
              },
              data: {
                paidAmount:
                  nextPaidAmount,
                unpaidAmount:
                  nextUnpaidAmount,
                status:
                  nextInvoiceStatus as any,
                paidAt:
                  nextInvoiceStatus ===
                  'PAID'
                    ? currentInvoice
                        .paidAt ??
                      occurredAt
                    : currentInvoice
                        .paidAt,
                metadata: {
                  ...currentInvoiceMetadata,

                  source:
                    'EDGE_PAID_EXIT_SYNC',

                  edgeNodeId:
                    input.edgeNodeId,
                  edgeSessionId:
                    this.stringValue(
                      input.payload
                        .sessionId,
                    ) ??
                    session.id,
                  edgeSessionNo:
                    this.stringValue(
                      input.payload
                        .sessionNo,
                    ) ??
                    session.sessionNo,

                  edgeInvoiceId,
                  edgeInvoiceNo,
                  edgeInvoiceStatus,
                  edgeInvoiceAmount,
                  edgeInvoicePaidAmount,
                  edgeInvoiceUnpaidAmount,

                  edgePaymentMethod:
                    paymentMethod,
                  edgePaymentProviderReference:
                    providerReference,
                  edgePaymentAppliedAmount:
                    paymentDelta,
                  edgePaymentSyncedAt:
                    occurredAt.toISOString(),

                  edgeCloudAmountDifference:
                    edgeInvoiceAmount -
                    currentInvoice.amount,
                } as any,
              },
            });

          if (
            !existingPaymentTransaction &&
            paymentDelta > 0
          ) {
            await (tx as any)
              .paymentTransaction
              .create({
                data: {
                  transactionNo: [
                    'EDGE',
                    occurredAt
                      .getTime(),
                    randomUUID()
                      .replace(
                        /-/g,
                        '',
                      )
                      .slice(
                        0,
                        12,
                      )
                      .toUpperCase(),
                  ].join('-'),

                  invoiceId:
                    updatedInvoice.id,
                  parkingSessionId:
                    session.id,

                  provider:
                    'EDGE_PAYMENT_SYNC',
                  method:
                    paymentMethod,
                  status:
                    'APPROVED',

                  amount:
                    paymentDelta,
                  currency:
                    'KRW',

                  providerReference,
                  approvedAt:
                    occurredAt,

                  metadata: {
                    source:
                      'PARKING_SESSION_EXITED_FROM_EDGE',
                    edgeNodeId:
                      input.edgeNodeId,
                    edgeEventId:
                      input.event
                        .eventId ??
                      null,
                    edgeSessionId:
                      this.stringValue(
                        input.payload
                          .sessionId,
                      ) ??
                      session.id,
                    edgeInvoiceId,
                    edgeInvoiceNo,
                    edgeReportedAmount:
                      edgeInvoiceAmount,
                    edgeReportedPaidAmount:
                      edgeInvoicePaidAmount,
                    edgeReportedUnpaidAmount:
                      edgeInvoiceUnpaidAmount,
                  } as any,
                },
              });
          }

          const sessionMetadata =
            this.asRecord(
              session.metadata,
            );

          await tx.parkingSession
            .update({
              where: {
                id:
                  session.id,
              },
              data: {
                primaryInvoiceId:
                  updatedInvoice.id,
                amount:
                  updatedInvoice.amount,
                paidAmount:
                  updatedInvoice.paidAmount,
                unpaidAmount:
                  updatedInvoice.unpaidAmount,

                metadata: {
                  ...sessionMetadata,

                  source:
                    'EDGE_SYNC',
                  edgeNodeId:
                    input.edgeNodeId,
                  syncedFromEdge:
                    true,
                  syncedFromEdgeAt:
                    new Date()
                      .toISOString(),

                  edgeInvoiceId,
                  edgeInvoiceNo,
                  edgeInvoiceStatus,
                  edgeInvoiceAmount,
                  edgeInvoicePaidAmount,
                  edgeInvoiceUnpaidAmount,

                  cloudInvoiceId:
                    updatedInvoice.id,
                  cloudInvoiceNo:
                    updatedInvoice
                      .invoiceNo,
                  cloudInvoiceStatus:
                    updatedInvoice.status,
                  cloudInvoiceAmount:
                    updatedInvoice.amount,
                  cloudInvoicePaidAmount:
                    updatedInvoice
                      .paidAmount,
                  cloudInvoiceUnpaidAmount:
                    updatedInvoice
                      .unpaidAmount,

                  /*
                   * 기존 UI 및 결제 서비스 호환용
                   * 공식 Cloud Invoice namespace.
                   */
                  invoiceId:
                    updatedInvoice.id,
                  invoiceNo:
                    updatedInvoice
                      .invoiceNo,
                  invoiceStatus:
                    updatedInvoice.status,
                  invoiceAmount:
                    updatedInvoice.amount,
                  invoicePaidAmount:
                    updatedInvoice
                      .paidAmount,
                  invoiceUnpaidAmount:
                    updatedInvoice
                      .unpaidAmount,

                  paymentStatus:
                    this
                      .resolvePaymentStatusFromInvoice({
                        paidAmount:
                          updatedInvoice
                            .paidAmount,
                        unpaidAmount:
                          updatedInvoice
                            .unpaidAmount,
                      }),

                  paymentRequired:
                    updatedInvoice
                      .unpaidAmount > 0,

                  invoiceCreatedAtEdge:
                    Boolean(
                      edgeInvoiceId,
                    ),
                  invoiceCreatedByCloudSync:
                    true,
                  invoiceSyncRequired:
                    false,

                  cloudInvoiceSyncedAt:
                    new Date()
                      .toISOString(),
                  cloudInvoiceSyncEventType:
                    'PARKING_SESSION_EXITED_FROM_EDGE',

                  feeCalculation:
                    ensured.calculation,
                } as any,
              },
            });

          await tx.parkingSessionEvent
            .create({
              data: {
                sessionId:
                  session.id,
                type:
                  'PAID_INVOICE_APPLIED_BY_CLOUD_SYNC',
                source:
                  'EDGE_SYNC',
                payload: {
                  edgeNodeId:
                    input.edgeNodeId,
                  edgeEventId:
                    input.event
                      .eventId ??
                    null,
                  edgeInvoiceId,
                  edgeInvoiceNo,
                  edgeInvoiceStatus,
                  edgeInvoiceAmount,
                  edgeInvoicePaidAmount,
                  edgeInvoiceUnpaidAmount,
                  cloudInvoiceId:
                    updatedInvoice.id,
                  cloudInvoiceNo:
                    updatedInvoice
                      .invoiceNo,
                  cloudInvoiceStatus:
                    updatedInvoice.status,
                  cloudInvoiceAmount:
                    updatedInvoice.amount,
                  cloudInvoicePaidAmount:
                    updatedInvoice
                      .paidAmount,
                  cloudInvoiceUnpaidAmount:
                    updatedInvoice
                      .unpaidAmount,
                  paymentDelta,
                  occurredAt:
                    occurredAt
                      .toISOString(),
                } as any,
              },
            });

          /*
           * Cloud 공식 Invoice를 Edge metadata에
           * 적용하기 위한 회신 Outbox.
           */
          const cloudToEdgeEvent =
            await tx.domainEvent
              .create({
                data: {
                  eventId:
                    randomUUID(),
                  aggregateType:
                    'Invoice',
                  aggregateId:
                    updatedInvoice.id,
                  eventType:
                    'INVOICE_CREATED_FROM_CLOUD',
                  payload: {
                    edgeNodeId:
                      input.edgeNodeId,
                    edgeSessionId:
                      this.stringValue(
                        input.payload
                          .sessionId,
                      ) ??
                      session.id,
                    edgeSessionNo:
                      this.stringValue(
                        input.payload
                          .sessionNo,
                      ) ??
                      session.sessionNo,
                    cloudSessionId:
                      session.id,
                    cloudSessionNo:
                      session.sessionNo,

                    invoiceId:
                      updatedInvoice.id,
                    invoiceNo:
                      updatedInvoice
                        .invoiceNo,
                    invoiceStatus:
                      updatedInvoice.status,
                    invoiceAmount:
                      updatedInvoice.amount,
                    invoicePaidAmount:
                      updatedInvoice
                        .paidAmount,
                    invoiceUnpaidAmount:
                      updatedInvoice
                        .unpaidAmount,

                    paymentStatus:
                      this
                        .resolvePaymentStatusFromInvoice({
                          paidAmount:
                            updatedInvoice
                              .paidAmount,
                          unpaidAmount:
                            updatedInvoice
                              .unpaidAmount,
                        }),

                    edgeInvoiceId,
                    edgeInvoiceNo,

                    occurredAt:
                      occurredAt
                        .toISOString(),

                    destination:
                      `EDGE:${input.edgeNodeId}`,
                    createdForEdgeSync:
                      true,
                  } as any,
                  occurredAt,
                },
              });

          await tx.syncOutbox
            .create({
              data: {
                domainEventId:
                  cloudToEdgeEvent.id,
                destination:
                  `EDGE:${input.edgeNodeId}`,
                status:
                  'PENDING' as any,
              },
            });

          return {
            invoice:
              updatedInvoice,
            paymentDelta,
            reusedPaymentTransaction:
              Boolean(
                existingPaymentTransaction,
              ),
          };
        },
      );

    return {
      action:
        'PAID_INVOICE_APPLIED_FROM_EDGE_EXIT',
      sessionId:
        session.id,
      sessionNo:
        session.sessionNo,
      paymentDelta:
        transactionResult.paymentDelta,
      reusedPaymentTransaction:
        transactionResult
          .reusedPaymentTransaction,
      invoice: {
        invoiceId:
          transactionResult.invoice.id,
        invoiceNo:
          transactionResult.invoice
            .invoiceNo,
        invoiceStatus:
          transactionResult.invoice
            .status,
        invoiceAmount:
          transactionResult.invoice
            .amount,
        invoicePaidAmount:
          transactionResult.invoice
            .paidAmount,
        invoiceUnpaidAmount:
          transactionResult.invoice
            .unpaidAmount,
      },
    };
  }

  private async createCloudInvoiceForEdgeUnpaidExit(input: {
    edgeNodeId: string;
    event: EdgePushEvent;
    payload: Record<string, unknown>;
  }) {
    const payload = this.normalizeUnpaidExitPayload(input.payload);

    /*
     * Edge에서 산출된 로컬 Invoice.
     * Cloud 공식 Invoice와 별도 식별자로 보존한다.
     */
    const edgeInvoice =
      this.asRecord(
        input.payload.edgeInvoice,
      );

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
      const existingSessionMetadata =
        this.asRecord(
          session.metadata,
        );

      await this.prisma.parkingSession.update({
        where: {
          id: session.id,
        },
        data: {
          paidAmount:
            existingInvoice.paidAmount,
          unpaidAmount:
            existingInvoice.unpaidAmount,
          metadata: {
            ...existingSessionMetadata,

            edgeInvoiceId:
              this.stringValue(edgeInvoice.id) ??
              existingSessionMetadata.edgeInvoiceId ??
              null,
            edgeInvoiceNo:
              this.stringValue(edgeInvoice.invoiceNo) ??
              existingSessionMetadata.edgeInvoiceNo ??
              null,
            edgeInvoiceStatus:
              this.stringValue(edgeInvoice.status) ??
              existingSessionMetadata.edgeInvoiceStatus ??
              null,
            edgeInvoiceAmount:
              this.numberValue(edgeInvoice.amount) ??
              existingSessionMetadata.edgeInvoiceAmount ??
              null,
            edgeInvoicePaidAmount:
              this.numberValue(edgeInvoice.paidAmount) ??
              existingSessionMetadata.edgeInvoicePaidAmount ??
              null,
            edgeInvoiceUnpaidAmount:
              this.numberValue(edgeInvoice.unpaidAmount) ??
              existingSessionMetadata.edgeInvoiceUnpaidAmount ??
              null,

            cloudInvoiceId:
              existingInvoice.id,
            cloudInvoiceNo:
              existingInvoice.invoiceNo,
            cloudInvoiceStatus:
              existingInvoice.status,
            cloudInvoiceAmount:
              existingInvoice.amount,
            cloudInvoicePaidAmount:
              existingInvoice.paidAmount,
            cloudInvoiceUnpaidAmount:
              existingInvoice.unpaidAmount,

            invoiceId:
              existingInvoice.id,
            invoiceNo:
              existingInvoice.invoiceNo,
            invoiceStatus:
              existingInvoice.status,
            invoiceAmount:
              existingInvoice.amount,
            invoicePaidAmount:
              existingInvoice.paidAmount,
            invoiceUnpaidAmount:
              existingInvoice.unpaidAmount,

            invoiceCreatedByCloudSync: true,
            invoiceCreatedAtEdge:
              Boolean(
                this.stringValue(edgeInvoice.id) ??
                existingSessionMetadata.edgeInvoiceId,
              ),
            invoiceSyncRequired: false,
          } as any,
        },
      });

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

          edgeInvoiceId:
            this.stringValue(edgeInvoice.id) ??
            sessionMetadata.edgeInvoiceId ??
            null,
          edgeInvoiceNo:
            this.stringValue(edgeInvoice.invoiceNo) ??
            sessionMetadata.edgeInvoiceNo ??
            null,
          edgeInvoiceStatus:
            this.stringValue(edgeInvoice.status) ??
            sessionMetadata.edgeInvoiceStatus ??
            null,
          edgeInvoiceAmount:
            this.numberValue(edgeInvoice.amount) ??
            sessionMetadata.edgeInvoiceAmount ??
            null,
          edgeInvoicePaidAmount:
            this.numberValue(edgeInvoice.paidAmount) ??
            sessionMetadata.edgeInvoicePaidAmount ??
            null,
          edgeInvoiceUnpaidAmount:
            this.numberValue(edgeInvoice.unpaidAmount) ??
            sessionMetadata.edgeInvoiceUnpaidAmount ??
            null,

          cloudInvoiceId:
            invoice.id,
          cloudInvoiceNo:
            invoice.invoiceNo,
          cloudInvoiceStatus:
            invoice.status,
          cloudInvoiceAmount:
            invoice.amount,
          cloudInvoicePaidAmount:
            invoice.paidAmount,
          cloudInvoiceUnpaidAmount:
            invoice.unpaidAmount,

          /*
           * 기존 UI 및 결제 서비스 호환용 공식 Cloud Invoice.
           */
          invoiceId:
            invoice.id,
          invoiceNo:
            invoice.invoiceNo,
          invoiceStatus:
            invoice.status,
          invoiceAmount:
            invoice.amount,
          invoicePaidAmount:
            invoice.paidAmount,
          invoiceUnpaidAmount:
            invoice.unpaidAmount,

          invoiceCreatedByCloudSync: true,
          invoiceCreatedAtEdge:
            Boolean(
              this.stringValue(edgeInvoice.id) ??
              sessionMetadata.edgeInvoiceId,
            ),
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
      sessionId?: string;
      sessionNo?: string;
      parkingLotId?: string;
      code?: string;
      approvalRequestId?: string;
      invoice?: Record<string, unknown> | null;
      [key: string]: unknown;
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
            sessionId: input.result.sessionId ?? null,
            sessionNo: input.result.sessionNo ?? null,
            parkingLotId: input.result.parkingLotId ?? null,
            code: input.result.code ?? null,
            approvalRequestId:
              input.result.approvalRequestId ??
              null,
            invoice: input.result.invoice ?? null,
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
    return isCloudProfile();
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