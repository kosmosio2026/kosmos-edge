import { randomUUID } from "crypto";
import {
  isCloudProfile,
  isConnectedEdgeProfile,
} from "../../common/config/app-mode";
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { ensureActiveParkingLotQr } from "../../common/parking-lot-qr/parking-lot-qr.helper";

import { ApprovalRequestType, ScopeType } from "@parking/db";

import { PrismaService } from "../../prisma/prisma.service";

type ReviewInput = {
  status: "APPROVED" | "REJECTED";
  reviewedNote?: string;
  rejectionReason?: string;
};

@Injectable()
export class ApprovalService {
  constructor(private readonly prisma: PrismaService) {}

  /*
   account registration approvals
  */

  async createManagerRequest(userId: string, dto: any) {
    let tenantId = dto.tenantId;

    if (!tenantId) {
      const tenant = await this.prisma.tenant.create({
        data: {
          name: dto.companyName,
          code: `TENANT-${Date.now()}`,
        },
      });

      tenantId = tenant.id;
    }

    await this.prisma.user.update({
      where: {
        id: userId,
      },
      data: {
        tenantId,
      },
    });

    return this.prisma.approvalRequest.create({
      data: {
        requesterId: userId,
        tenantId,
        type: "MANAGER_REGISTRATION" as ApprovalRequestType,
        companyName: dto.companyName,
        requestedParkingLotName: dto.requestedParkingLotName,
        status: "PENDING",
      },
      include: {
        requester: true,
        tenant: true,
      },
    });
  }

  async createOperatorRequest(userId: string, dto: any) {
    const parkingLot = dto.requestedParkingLotId
      ? await this.prisma.parkingLot.findUnique({
          where: {
            id: dto.requestedParkingLotId,
          },
          select: {
            managementCompanyId: true,
          },
        })
      : null;

    return this.prisma.approvalRequest.create({
      data: {
        requesterId: userId,
        managementCompanyId: parkingLot?.managementCompanyId ?? null,
        type: "OPERATOR_REGISTRATION" as ApprovalRequestType,
        requestedParkingLotId: dto.requestedParkingLotId,
        requestedSectionId: dto.requestedSectionId,
        companyName: dto.companyName,
        status: "PENDING",
      },
      include: {
        requester: true,
        tenant: true,
      },
    });
  }

  async listPendingManagersForAdmin() {
    const items = await this.prisma.approvalRequest.findMany({
      where: {
        type: "MANAGER_REGISTRATION",
        status: "PENDING",
      },
      include: {
        requester: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return items.map((item) => this.mapRegistrationApproval(item));
  }

  async listPendingOperatorsForAdminOrManager(userId: string) {
    const { isAdmin, isManager } = await this.getRoleFlags(userId);

    if (!isAdmin && !isManager) {
      throw new BadRequestException(
        "Only admin or manager can view operator approvals.",
      );
    }

    const reviewer = await this.prisma.user.findUnique({
      where: {
        id: userId,
      },
      select: {
        tenantId: true,
      },
    });

    const items = await this.prisma.approvalRequest.findMany({
      where: {
        type: "OPERATOR_REGISTRATION",
        status: "PENDING",
        ...(isAdmin
          ? {}
          : {
              tenantId: reviewer?.tenantId,
            }),
      },
      include: {
        requester: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return items.map((item) => this.mapRegistrationApproval(item));
  }

  async listPendingForManager(userId: string) {
    const managerLots = await this.prisma.managerParkingLot.findMany({
      where: {
        managerProfileUserId: userId,
      },
      select: {
        parkingLotId: true,
      },
    });

    const parkingLotIds = managerLots.map((item) => item.parkingLotId);

    return this.prisma.approvalRequest.findMany({
      where: {
        type: "OPERATOR_REGISTRATION",
        status: "PENDING",
        ...(parkingLotIds.length
          ? {
              requestedParkingLotId: {
                in: parkingLotIds,
              },
            }
          : {}),
      },
      include: {
        requester: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    });
  }

  /*
   manager parking lot access
  */

  async createParkingLotRequest(
    userId: string,
    dto: {
      type?: "PARKING_LOT_ACCESS" | "PARKING_LOT_CREATION";
      requestedParkingLotId?: string;
      requestedParkingLotName?: string;
      address?: string;
      note?: string;
      reason?: string;
      requestReason?: string;
    },
  ) {
    const requestType = dto.type ?? "PARKING_LOT_ACCESS";
    const note = dto.note ?? dto.reason ?? dto.requestReason ?? null;

    if (requestType === "PARKING_LOT_CREATION") {
      throw new BadRequestException(
        "주차장 생성 승인 방식은 더 이상 사용하지 않습니다. 주차장을 먼저 생성한 후 관리 권한을 신청하세요.",
      );
    }

    if (requestType === "PARKING_LOT_ACCESS" && !dto.requestedParkingLotId) {
      throw new BadRequestException("requestedParkingLotId is required.");
    }

    const user = await this.prisma.user.findUnique({
      where: {
        id: userId,
      },
      select: {
        managementCompanyId: true,
      },
    });

    const parkingLot = dto.requestedParkingLotId
      ? await this.prisma.parkingLot.findUnique({
          where: {
            id: dto.requestedParkingLotId,
          },
          select: {
            id: true,
            name: true,
            managementCompanyId: true,
          },
        })
      : null;

    if (requestType === "PARKING_LOT_ACCESS" && dto.requestedParkingLotId) {
      const approvedLot = await this.prisma.managerParkingLot.findUnique({
        where: {
          managerProfileUserId_parkingLotId: {
            managerProfileUserId: userId,
            parkingLotId: dto.requestedParkingLotId,
          },
        },
      });

      if (approvedLot) {
        throw new BadRequestException("이미 승인된 주차장입니다.");
      }

      const pendingRequest = await this.prisma.approvalRequest.findFirst({
        where: {
          requesterId: userId,
          requestedParkingLotId: dto.requestedParkingLotId,
          type: {
            in: ["PARKING_LOT_ACCESS", "MANAGER_LOT_ACCESS"],
          },
          status: "PENDING",
        },
      });

      if (pendingRequest) {
        throw new BadRequestException("이미 신청 대기 중인 주차장입니다.");
      }
    }

    return this.prisma.approvalRequest.create({
      data: {
        requesterId: userId,
        managementCompanyId:
          parkingLot?.managementCompanyId ?? user?.managementCompanyId ?? null,
        type: requestType,
        requestedParkingLotId: dto.requestedParkingLotId,
        requestedParkingLotName:
          dto.requestedParkingLotName ?? parkingLot?.name ?? null,
        memo: note,
        status: "PENDING",
      },
      include: {
        requester: true,
        tenant: true,
      },
    });
  }

  private async ensureManagerLotAccessEdgeSync(
    tx: any,
    item: {
      id: string;
      requesterId: string;
      requestedParkingLotId: string | null;
      requestedParkingLotName: string | null;
      managementCompanyId: string | null;
      memo: string | null;
      createdAt: Date;
    },
  ) {
    if (!isConnectedEdgeProfile()) {
      return null;
    }

    if (!item.requestedParkingLotId) {
      throw new BadRequestException(
        "주차장 관리 권한 신청에 주차장 ID가 필요합니다.",
      );
    }

    const eventType = "MANAGER_LOT_ACCESS_REQUESTED_EDGE_SYNC_REQUIRED";

    let event = await tx.domainEvent.findFirst({
      where: {
        aggregateType: "ApprovalRequest",
        aggregateId: item.id,
        eventType,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    if (!event) {
      event = await tx.domainEvent.create({
        data: {
          eventId: randomUUID(),
          aggregateType: "ApprovalRequest",
          aggregateId: item.id,
          eventType,
          payload: {
            approvalRequestId: item.id,
            requesterId: item.requesterId,
            parkingLotId: item.requestedParkingLotId,
            requestedParkingLotId: item.requestedParkingLotId,
            requestedParkingLotName: item.requestedParkingLotName,
            managementCompanyId: item.managementCompanyId,
            memo: item.memo,
            requestedAt: item.createdAt.toISOString(),
            sourceEdgeNodeId: process.env.EDGE_NODE_ID ?? null,
            destination: "CLOUD",
            createdForCloudSync: true,
          },
          occurredAt: item.createdAt,
        },
      });
    }

    let outbox = await tx.syncOutbox.findFirst({
      where: {
        domainEventId: event.id,
        destination: "CLOUD",
      },
    });

    if (!outbox) {
      outbox = await tx.syncOutbox.create({
        data: {
          domainEventId: event.id,
          destination: "CLOUD",
          status: "PENDING",
        },
      });
    }

    return {
      eventId: event.eventId,
      outboxId: outbox.id,
      status: outbox.status,
    };
  }

  async listRequestableManagerLots(userId: string) {
    const managerProfile = await this.prisma.managerProfile.findUnique({
      where: {
        userId,
      },
      select: {
        userId: true,
      },
    });

    if (!managerProfile) {
      throw new BadRequestException("매니저 프로필을 찾을 수 없습니다.");
    }

    const [managedRows, pendingRows, parkingLots] = await Promise.all([
      this.prisma.managerParkingLot.findMany({
        where: {
          managerProfileUserId: userId,
        },
        select: {
          parkingLotId: true,
        },
      }),
      this.prisma.approvalRequest.findMany({
        where: {
          requesterId: userId,
          type: {
            in: ["MANAGER_LOT_ACCESS", "PARKING_LOT_ACCESS"],
          },
          status: "PENDING",
          requestedParkingLotId: {
            not: null,
          },
        },
        select: {
          id: true,
          requestedParkingLotId: true,
          createdAt: true,
        },
      }),
      this.prisma.parkingLot.findMany({
        where: {
          isActive: true,
        },
        select: {
          id: true,
          code: true,
          name: true,
          region: true,
          district: true,
          address: true,
          operationMode: true,
          isActive: true,
          createdAt: true,
        },
        orderBy: [
          {
            region: "asc",
          },
          {
            name: "asc",
          },
          {
            createdAt: "desc",
          },
        ],
      }),
    ]);

    const managedIds = new Set(managedRows.map((item) => item.parkingLotId));

    const pendingByLotId = new Map(
      pendingRows
        .filter((item) => Boolean(item.requestedParkingLotId))
        .map((item) => [item.requestedParkingLotId as string, item]),
    );

    return parkingLots
      .filter((item) => !managedIds.has(item.id))
      .map((item) => {
        const pending = pendingByLotId.get(item.id);

        return {
          ...item,
          requestStatus: pending ? "PENDING" : null,
          requestId: pending?.id ?? null,
          requestedAt: pending?.createdAt ?? null,
        };
      });
  }

  async createManagerLotAccessRequest(
    userId: string,
    input: {
      parkingLotId?: string;
      note?: string;
    },
  ) {
    if (!input.parkingLotId) {
      throw new BadRequestException("parkingLotId is required.");
    }

    const [parkingLot, managerProfile] = await Promise.all([
      this.prisma.parkingLot.findUnique({
        where: {
          id: input.parkingLotId,
        },
        select: {
          id: true,
          name: true,
          managementCompanyId: true,
        },
      }),
      this.prisma.managerProfile.findUnique({
        where: {
          userId,
        },
        select: {
          userId: true,
        },
      }),
    ]);

    if (!parkingLot) {
      throw new NotFoundException("Parking lot not found.");
    }

    if (!managerProfile) {
      throw new BadRequestException("매니저 프로필을 찾을 수 없습니다.");
    }

    const approved = await this.prisma.managerParkingLot.findUnique({
      where: {
        managerProfileUserId_parkingLotId: {
          managerProfileUserId: userId,
          parkingLotId: parkingLot.id,
        },
      },
    });

    if (approved) {
      return {
        ok: true,
        alreadyApproved: true,
        duplicated: false,
        item: null,
        edgeCloudSync: null,
      };
    }

    const existing = await this.prisma.approvalRequest.findFirst({
      where: {
        requesterId: userId,
        requestedParkingLotId: parkingLot.id,
        type: {
          in: ["MANAGER_LOT_ACCESS", "PARKING_LOT_ACCESS"],
        },
        status: "PENDING",
      },
    });

    if (existing) {
      return this.prisma.$transaction(async (tx) => {
        const edgeCloudSync = await this.ensureManagerLotAccessEdgeSync(
          tx,
          existing,
        );

        return {
          ok: true,
          duplicated: true,
          alreadyApproved: false,
          item: existing,
          edgeCloudSync,
        };
      });
    }

    return this.prisma.$transaction(async (tx) => {
      const item = await tx.approvalRequest.create({
        data: {
          requesterId: userId,
          managementCompanyId: parkingLot.managementCompanyId ?? null,
          type: "MANAGER_LOT_ACCESS",
          requestedParkingLotId: parkingLot.id,
          requestedParkingLotName: parkingLot.name,
          memo: input.note ?? null,
          status: "PENDING",
          requestData: isConnectedEdgeProfile()
            ? {
                source: "EDGE",
                sourceEdgeNodeId: process.env.EDGE_NODE_ID ?? null,
                createdForCloudSync: true,
              }
            : undefined,
        },
        include: {
          requester: true,
        },
      });

      const edgeCloudSync = await this.ensureManagerLotAccessEdgeSync(tx, item);

      return {
        ok: true,
        duplicated: false,
        alreadyApproved: false,
        item,
        edgeCloudSync,
      };
    });
  }

  async listPendingParkingLotsForAdmin() {
    const items = await this.prisma.approvalRequest.findMany({
      where: {
        type: {
          in: [
            "MANAGER_LOT_ACCESS",
            "MANAGER_SCOPE_ACCESS",
            "PARKING_LOT_ACCESS",
            "PARKING_LOT_CREATION",
          ],
        },
        status: "PENDING",
      },
      include: {
        requester: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return items.map((item) => ({
      id: item.id,
      requesterId: item.requesterId,
      managerName: item.requester?.name ?? null,
      managerEmail: item.requester?.email ?? null,
      managerPhone: (item.requester as any)?.phone ?? null,
      type: item.type,
      requestedParkingLotId: item.requestedParkingLotId,
      requestedParkingLotName: item.requestedParkingLotName,
      status: item.status,
      createdAt: item.createdAt,
    }));
  }

  /*
   operator section access
  */

  async createOperatorSectionRequest(
    userId: string,
    dto: {
      requestedParkingLotId: string;
      requestedSectionId: string;
      note?: string;
    },
  ) {
    return this.createOperatorSectionAccessRequest(userId, {
      parkingLotId: dto.requestedParkingLotId,
      sectionId: dto.requestedSectionId,
      note: dto.note,
    });
  }

  async createOperatorSectionAccessRequest(
    userId: string,
    input: {
      parkingLotId?: string;
      sectionId?: string;
      note?: string;
    },
  ) {
    if (!input.parkingLotId) {
      throw new BadRequestException("parkingLotId is required.");
    }

    if (!input.sectionId) {
      throw new BadRequestException("sectionId is required.");
    }

    const section = await this.prisma.parkingSection.findUnique({
      where: {
        id: input.sectionId,
      },
      include: {
        parkingLot: true,
      },
    });

    if (!section) {
      throw new NotFoundException("Parking section not found.");
    }

    if (section.parkingLotId !== input.parkingLotId) {
      throw new BadRequestException(
        "Section does not belong to selected parking lot.",
      );
    }

    const existing = await this.prisma.approvalRequest.findFirst({
      where: {
        requesterId: userId,
        requestedParkingLotId: input.parkingLotId,
        requestedSectionId: input.sectionId,
        type: "OPERATOR_SECTION_ACCESS",
        status: "PENDING",
      },
    });

    if (existing) {
      return {
        ok: true,
        duplicated: true,
        item: existing,
      };
    }

    const item = await this.prisma.approvalRequest.create({
      data: {
        requesterId: userId,
        managementCompanyId: section.parkingLot?.managementCompanyId ?? null,
        type: "OPERATOR_SECTION_ACCESS",
        requestedParkingLotId: input.parkingLotId,
        requestedSectionId: input.sectionId,
        requestedParkingLotName: section.parkingLot?.name,
        memo: input.note,
        status: "PENDING",
      },
      include: {
        requester: true,
      },
    });

    return {
      ok: true,
      item,
    };
  }

  async listPendingOperatorSectionRequests(userId: string) {
    const { isAdmin } = await this.getRoleFlags(userId);

    if (isAdmin) {
      const items = await this.prisma.approvalRequest.findMany({
        where: {
          type: "OPERATOR_SECTION_ACCESS",
          status: "PENDING",
        },
        include: {
          requester: true,
        },
        orderBy: {
          createdAt: "desc",
        },
      });

      return this.attachOperatorSectionNames(items);
    }

    const managerLots = await this.prisma.managerParkingLot.findMany({
      where: {
        managerProfileUserId: userId,
      },
      select: {
        parkingLotId: true,
      },
    });

    const parkingLotIds = managerLots.map((item) => item.parkingLotId);

    const items = await this.prisma.approvalRequest.findMany({
      where: {
        type: "OPERATOR_SECTION_ACCESS",
        status: "PENDING",
        requestedParkingLotId: {
          in: parkingLotIds,
        },
      },
      include: {
        requester: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return this.attachOperatorSectionNames(items);
  }

  async withdrawOperatorSectionRequest(userId: string, requestId: string) {
    const req = await this.prisma.approvalRequest.findUnique({
      where: {
        id: requestId,
      },
    });

    if (!req) {
      throw new NotFoundException("Approval request not found.");
    }

    if (req.requesterId !== userId) {
      throw new ForbiddenException("You can only withdraw your own request.");
    }

    if (req.type !== "OPERATOR_SECTION_ACCESS") {
      throw new BadRequestException(
        "Only operator section requests can be withdrawn.",
      );
    }

    if (req.status !== "PENDING") {
      throw new BadRequestException("Only pending requests can be withdrawn.");
    }

    await this.prisma.approvalRequest.delete({
      where: {
        id: requestId,
      },
    });

    return {
      ok: true,
      withdrawn: true,
      id: requestId,
    };
  }

  private async enqueueManagerLotReviewToEdge(
    tx: any,
    item: any,
    input: {
      status: "APPROVED" | "REJECTED";
      reviewerId: string;
      reviewedNote?: string;
    },
  ) {
    if (!isCloudProfile()) {
      return null;
    }

    if (
      item.type !== "MANAGER_LOT_ACCESS" &&
      item.type !== "MANAGER_SCOPE_ACCESS" &&
      item.type !== "PARKING_LOT_ACCESS"
    ) {
      return null;
    }

    if (!item.requestedParkingLotId) {
      return null;
    }

    const requestData =
      item.requestData &&
      typeof item.requestData === "object" &&
      !Array.isArray(item.requestData)
        ? (item.requestData as Record<string, unknown>)
        : {};

    const sourceIsEdge =
      requestData.source === "EDGE" ||
      requestData.syncedFromEdge === true ||
      typeof requestData.edgeApprovalRequestId === "string" ||
      typeof requestData.sourceEdgeNodeId === "string";

    if (!sourceIsEdge) {
      return null;
    }

    const edgeApprovalRequestId =
      typeof requestData.edgeApprovalRequestId === "string" &&
      requestData.edgeApprovalRequestId
        ? requestData.edgeApprovalRequestId
        : item.id;

    let edgeNodeId =
      typeof requestData.sourceEdgeNodeId === "string" &&
      requestData.sourceEdgeNodeId
        ? requestData.sourceEdgeNodeId
        : null;

    if (!edgeNodeId) {
      const edgeLink = await tx.edgeParkingLot.findFirst({
        where: {
          parkingLotId: item.requestedParkingLotId,
        },
        select: {
          edgeNodeId: true,
        },
        orderBy: {
          createdAt: "asc",
        },
      });

      edgeNodeId = edgeLink?.edgeNodeId ?? null;
    }

    if (!edgeNodeId) {
      return null;
    }

    const eventType =
      input.status === "APPROVED"
        ? "MANAGER_LOT_ACCESS_APPROVED_FROM_CLOUD"
        : "MANAGER_LOT_ACCESS_REJECTED_FROM_CLOUD";

    const reviewedAt =
      item.reviewedAt instanceof Date ? item.reviewedAt : new Date();

    let event = await tx.domainEvent.findFirst({
      where: {
        aggregateType: "ApprovalRequest",
        aggregateId: item.id,
        eventType,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    if (!event) {
      event = await tx.domainEvent.create({
        data: {
          eventId: randomUUID(),
          aggregateType: "ApprovalRequest",
          aggregateId: item.id,
          eventType,
          payload: {
            cloudApprovalRequestId: item.id,
            edgeApprovalRequestId,
            requesterId: item.requesterId,
            parkingLotId: item.requestedParkingLotId,
            status: input.status,
            reviewedById: item.reviewedById ?? input.reviewerId,
            reviewedAt: reviewedAt.toISOString(),
            rejectionReason:
              input.status === "REJECTED"
                ? (item.rejectionReason ?? input.reviewedNote ?? null)
                : null,
            sourceEdgeNodeId: edgeNodeId,
            destination: `EDGE:${edgeNodeId}`,
            createdForEdgeSync: true,
          },
          occurredAt: reviewedAt,
        },
      });
    }

    let outbox = await tx.syncOutbox.findFirst({
      where: {
        domainEventId: event.id,
        destination: `EDGE:${edgeNodeId}`,
      },
    });

    if (!outbox) {
      outbox = await tx.syncOutbox.create({
        data: {
          domainEventId: event.id,
          destination: `EDGE:${edgeNodeId}`,
          status: "PENDING",
        },
      });
    }

    return {
      edgeNodeId,
      edgeApprovalRequestId,
      eventId: event.eventId,
      outboxId: outbox.id,
      status: outbox.status,
      eventType,
    };
  }

  /*
   review
  */

  async review(reviewerId: string, requestId: string, dto: ReviewInput) {
    const req = await this.prisma.approvalRequest.findUnique({
      where: {
        id: requestId,
      },
    });

    if (!req) {
      throw new NotFoundException("Approval request not found.");
    }

    if (req.status !== "PENDING") {
      const edgeCloudSync = await this.prisma.$transaction(async (tx) =>
        this.enqueueManagerLotReviewToEdge(tx, req, {
          status: req.status as "APPROVED" | "REJECTED",
          reviewerId: req.reviewedById ?? reviewerId,
          reviewedNote: req.rejectionReason ?? undefined,
        }),
      );

      return {
        ok: true,
        alreadyReviewed: true,
        item: req,
        edgeCloudSync,
      };
    }

    if (dto.status === "REJECTED") {
      const rejected = await this.prisma.$transaction(async (tx) => {
        const item = await tx.approvalRequest.update({
          where: {
            id: requestId,
          },
          data: {
            status: "REJECTED",
            reviewedAt: new Date(),
            rejectionReason: dto.rejectionReason ?? dto.reviewedNote,
            reviewer: {
              connect: {
                id: reviewerId,
              },
            },
          },
        });

        const edgeCloudSync = await this.enqueueManagerLotReviewToEdge(
          tx,
          item,
          {
            status: "REJECTED",
            reviewerId,
            reviewedNote: dto.rejectionReason ?? dto.reviewedNote,
          },
        );

        return {
          item,
          edgeCloudSync,
        };
      });

      return {
        ok: true,
        item: rejected.item,
        edgeCloudSync: rejected.edgeCloudSync,
      };
    }

    const saved = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.approvalRequest.update({
        where: {
          id: requestId,
        },
        data: {
          status: "APPROVED",
          reviewedAt: new Date(),
          reviewer: {
            connect: {
              id: reviewerId,
            },
          },
        },
        include: {
          requester: true,
        },
      });

      if (req.type === "MANAGER_REGISTRATION") {
        const managerRole = await tx.role.findUniqueOrThrow({
          where: {
            code: "MANAGER",
          },
        });

        await tx.userRole.upsert({
          where: {
            userId_roleId: {
              userId: req.requesterId,
              roleId: managerRole.id,
            },
          },
          update: {},
          create: {
            userId: req.requesterId,
            roleId: managerRole.id,
          },
        });

        await tx.user.update({
          where: {
            id: req.requesterId,
          },
          data: {
            isApproved: true,
          },
        });

        await tx.managerProfile.upsert({
          where: {
            userId: req.requesterId,
          },
          update: {
            companyName: req.companyName ?? "",
            approvedAt: new Date(),
            approvedById: reviewerId,
          },
          create: {
            userId: req.requesterId,
            companyName: req.companyName ?? "",
            approvedAt: new Date(),
            approvedById: reviewerId,
          },
        });
      }

      if (req.type === "MANAGER_REGISTRATION") {
        const requestData = (req as any).requestData as
          | {
              managerRegisterMode?: "CREATE_TENANT" | "JOIN_TENANT";
              tenantRole?: "TENANT_OWNER" | "MANAGER";
            }
          | null
          | undefined;

        const tenantRole =
          requestData?.tenantRole ??
          (requestData?.managerRegisterMode === "JOIN_TENANT"
            ? "MANAGER"
            : "TENANT_OWNER");

        if (req.tenantId) {
          await tx.tenantUser.upsert({
            where: {
              tenantId_userId_role: {
                tenantId: req.tenantId,
                userId: req.requesterId,
                role: tenantRole,
              },
            },
            update: {
              status: "ACTIVE",
            },
            create: {
              tenantId: req.tenantId,
              userId: req.requesterId,
              role: tenantRole,
              status: "ACTIVE",
            },
          });
        }
      }

      if (req.type === "OPERATOR_REGISTRATION") {
        const operatorRole = await tx.role.findUniqueOrThrow({
          where: {
            code: "OPERATOR",
          },
        });

        await tx.userRole.upsert({
          where: {
            userId_roleId: {
              userId: req.requesterId,
              roleId: operatorRole.id,
            },
          },
          update: {},
          create: {
            userId: req.requesterId,
            roleId: operatorRole.id,
          },
        });

        await tx.user.update({
          where: {
            id: req.requesterId,
          },
          data: {
            isApproved: true,
          },
        });

        await tx.operatorProfile.upsert({
          where: {
            userId: req.requesterId,
          },
          update: {
            companyName: req.companyName ?? "",
            approvedAt: new Date(),
            approvedById: reviewerId,
          },
          create: {
            userId: req.requesterId,
            companyName: req.companyName ?? "",
            approvedAt: new Date(),
            approvedById: reviewerId,
          },
        });
      }

      if (
        req.type === "MANAGER_LOT_ACCESS" ||
        req.type === "MANAGER_SCOPE_ACCESS" ||
        req.type === "PARKING_LOT_ACCESS" ||
        req.type === "PARKING_LOT_CREATION"
      ) {
        await this.applyManagerLotApproval(tx, req, reviewerId);
      }

      if (
        req.type === "OPERATOR_SECTION_ACCESS" ||
        req.type === "OPERATOR_SCOPE_ACCESS"
      ) {
        await this.applyOperatorSectionApproval(tx, req, reviewerId);
      }

      const edgeCloudSync = await this.enqueueManagerLotReviewToEdge(
        tx,
        updated,
        {
          status: "APPROVED",
          reviewerId,
          reviewedNote: dto.reviewedNote,
        },
      );

      return {
        item: updated,
        edgeCloudSync,
      };
    });

    return {
      ok: true,
      item: saved.item,
      edgeCloudSync: saved.edgeCloudSync,
    };
  }

  private async applyManagerLotApproval(
    tx: any,
    req: {
      requesterId: string;
      tenantId: string | null;
      managementCompanyId: string | null;
      requestedParkingLotId: string | null;
      requestedParkingLotName: string | null;
      type: ApprovalRequestType;
    },
    reviewerId: string,
  ) {
    const managerProfile = await tx.managerProfile.findUnique({
      where: {
        userId: req.requesterId,
      },
    });

    if (!managerProfile) {
      throw new BadRequestException("Manager profile not found.");
    }

    let parkingLotId = req.requestedParkingLotId;

    if (req.type === "PARKING_LOT_CREATION") {
      if (!managerProfile.managementCompanyId) {
        throw new BadRequestException("Manager management company not found.");
      }

      const parkingLot = await tx.parkingLot.create({
        data: {
          name: req.requestedParkingLotName ?? "New Parking Lot",
          code: `LOT-${Date.now()}`,
          managementCompanyId: managerProfile.managementCompanyId,
        },
      });

      await ensureActiveParkingLotQr(tx, parkingLot);

      parkingLotId = parkingLot.id;
    }

    if (!parkingLotId) {
      throw new BadRequestException("Parking lot id is required.");
    }

    await tx.managerParkingLot.upsert({
      where: {
        managerProfileUserId_parkingLotId: {
          managerProfileUserId: managerProfile.userId,
          parkingLotId,
        },
      },
      update: {},
      create: {
        managerProfileUserId: managerProfile.userId,
        parkingLotId,
      },
    });

    const existingScope = await tx.userScopeBinding.findFirst({
      where: {
        userId: req.requesterId,
        scopeType: ScopeType.LOT,
        parkingLotId,
      },
    });

    if (!existingScope) {
      await tx.userScopeBinding.create({
        data: {
          userId: req.requesterId,
          scopeType: ScopeType.LOT,
          parkingLotId,
        },
      });
    }

    await tx.managerProfile.update({
      where: {
        userId: req.requesterId,
      },
      data: {
        approvedAt: new Date(),
        approvedById: reviewerId,
      },
    });
  }

  private async applyOperatorSectionApproval(
    tx: any,
    req: {
      requesterId: string;
      requestedParkingLotId: string | null;
      requestedSectionId: string | null;
    },
    reviewerId: string,
  ) {
    const operatorProfile = await tx.operatorProfile.findUnique({
      where: {
        userId: req.requesterId,
      },
    });

    if (!operatorProfile) {
      throw new BadRequestException("Operator profile not found.");
    }

    if (!req.requestedParkingLotId) {
      throw new BadRequestException("Parking lot id is required.");
    }

    if (!req.requestedSectionId) {
      throw new BadRequestException("Section id is required.");
    }

    await tx.operatorParkingSection.upsert({
      where: {
        operatorProfileUserId_sectionId: {
          operatorProfileUserId: operatorProfile.userId,
          sectionId: req.requestedSectionId,
        },
      },
      update: {},
      create: {
        operatorProfileUserId: operatorProfile.userId,
        parkingLotId: req.requestedParkingLotId,
        sectionId: req.requestedSectionId,
      },
    });

    const existingScope = await tx.userScopeBinding.findFirst({
      where: {
        userId: req.requesterId,
        scopeType: ScopeType.SECTION,
        parkingSectionId: req.requestedSectionId,
      },
    });

    if (!existingScope) {
      await tx.userScopeBinding.create({
        data: {
          userId: req.requesterId,
          scopeType: ScopeType.SECTION,
          parkingLotId: req.requestedParkingLotId,
          parkingSectionId: req.requestedSectionId,
        },
      });
    }

    await tx.operatorProfile.update({
      where: {
        userId: req.requesterId,
      },
      data: {
        approvedAt: new Date(),
        approvedById: reviewerId,
      },
    });
  }

  private async getRoleFlags(userId: string) {
    const userRoles = await this.prisma.userRole.findMany({
      where: {
        userId,
      },
      include: {
        role: true,
      },
    });

    return {
      isAdmin: userRoles.some((item) => item.role.code === "ADMIN"),
      isManager: userRoles.some((item) => item.role.code === "MANAGER"),
      isOperator: userRoles.some((item) => item.role.code === "OPERATOR"),
    };
  }

  private mapRegistrationApproval(item: any) {
    return {
      id: item.id,
      requesterId: item.requesterId,
      name: item.requester?.name ?? null,
      email: item.requester?.email ?? null,
      phone: item.requester?.phone ?? null,
      companyName: item.companyName ?? null,
      status: item.status,
      createdAt: item.createdAt,
    };
  }
  async listPendingOperatorSectionRequestsForAdmin() {
    const items = await this.prisma.approvalRequest.findMany({
      where: {
        type: {
          in: [
            "OPERATOR_SECTION_ACCESS",
            "OPERATOR_SCOPE_ACCESS",
          ] as ApprovalRequestType[],
        },
        status: "PENDING",
      },
      include: {
        requester: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return items.map((item) => this.mapOperatorSectionApproval(item));
  }

  async listMyOperatorSectionRequests(userId: string) {
    const items = await this.prisma.approvalRequest.findMany({
      where: {
        requesterId: userId,
        type: {
          in: [
            "OPERATOR_SECTION_ACCESS",
            "OPERATOR_SCOPE_ACCESS",
          ] as ApprovalRequestType[],
        },
      },
      include: {
        requester: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return items.map((item) => this.mapOperatorSectionApproval(item));
  }

  private async attachOperatorSectionNames(items: any[]) {
    const parkingLotIds = Array.from(
      new Set(items.map((item) => item.requestedParkingLotId).filter(Boolean)),
    );

    const sectionIds = Array.from(
      new Set(items.map((item) => item.requestedSectionId).filter(Boolean)),
    );

    const [parkingLots, sections] = await Promise.all([
      parkingLotIds.length
        ? this.prisma.parkingLot.findMany({
            where: { id: { in: parkingLotIds } },
            select: { id: true, name: true, code: true },
          })
        : Promise.resolve([]),
      sectionIds.length
        ? this.prisma.parkingSection.findMany({
            where: { id: { in: sectionIds } },
            select: { id: true, name: true, code: true },
          })
        : Promise.resolve([]),
    ]);

    const parkingLotById = new Map(parkingLots.map((item) => [item.id, item]));
    const sectionById = new Map(sections.map((item) => [item.id, item]));

    return items.map((item) => ({
      ...item,
      parkingLot: item.requestedParkingLotId
        ? (parkingLotById.get(item.requestedParkingLotId) ?? null)
        : null,
      parkingSection: item.requestedSectionId
        ? (sectionById.get(item.requestedSectionId) ?? null)
        : null,
    }));
  }

  private mapOperatorSectionApproval(item: any) {
    return {
      id: item.id,
      requesterId: item.requesterId,
      operatorName: item.requester?.name ?? null,
      operatorEmail: item.requester?.email ?? null,
      operatorPhone: item.requester?.phone ?? null,
      type: item.type,
      requestedParkingLotId: item.requestedParkingLotId,
      requestedParkingLotName: item.requestedParkingLotName,
      requestedSectionId: item.requestedSectionId,
      status: item.status,
      memo: item.memo,
      rejectionReason: item.rejectionReason,
      createdAt: item.createdAt,
      reviewedAt: item.reviewedAt,
    };
  }
}
