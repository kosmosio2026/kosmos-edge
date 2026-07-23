import {
  isCloudProfile,
  isConnectedEdgeProfile,
  isEdgeStandaloneProfile,
} from "../../../common/config/app-mode";
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { randomUUID } from "crypto";
import { ScopeType, SpaceStatus, SpaceType } from "@parking/db";
import { PrismaService } from "../../../prisma/prisma.service";
import { ensureActiveParkingLotQr } from "../../../common/parking-lot-qr/parking-lot-qr.helper";
import { CreateParkingLotDto } from "./dto/create-parking-lot.dto";
import { UpdateParkingLotDto } from "./dto/update-parking-lot.dto";
import type { AuthUser } from "../../../common/types/auth-user.type";
import {
  getManagerParkingLotIds,
  getOperatorParkingLotIds,
  isAdmin,
  isManager,
  isOperator,
} from "../common/facility-scope";

type LotStatusFilter = "active" | "inactive" | "all";

type ImportError = {
  row: number;
  field: string;
  message: string;
};

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : String(value ?? "").trim();
}

function optionalText(value: unknown) {
  const valueText = text(value);
  return valueText || null;
}

function normalizeSidoName(value: unknown) {
  const raw = text(value);

  const sidoMap: Record<string, string> = {
    서울: "서울특별시",
    부산: "부산광역시",
    대구: "대구광역시",
    인천: "인천광역시",
    광주: "광주광역시",
    대전: "대전광역시",
    울산: "울산광역시",
    세종: "세종특별자치시",
    경기: "경기도",
    강원: "강원특별자치도",
    충북: "충청북도",
    충남: "충청남도",
    전북: "전북특별자치도",
    전남: "전라남도",
    경북: "경상북도",
    경남: "경상남도",
    제주: "제주특별자치도",
  };

  return sidoMap[raw] ?? raw;
}

function normalizeRegion(value: unknown) {
  return optionalText(normalizeSidoName(value));
}

function normalizeDistrict(value: unknown) {
  return optionalText(value);
}

type ParkingLotPayloadInput = {
  code?: unknown;
  name?: unknown;
  region?: unknown;
  district?: unknown;
  address?: unknown;
  lat?: unknown;
  lng?: unknown;
  representative?: unknown;
  contact?: unknown;
  operationMode?: string | null;
};

function requireText(value: unknown, label: string, minLength = 1) {
  const valueText = text(value);

  if (!valueText) {
    throw new BadRequestException(`${label}은(는) 필수입니다.`);
  }

  if (valueText.length < minLength) {
    throw new BadRequestException(
      `${label}은(는) ${minLength}자 이상 입력하세요.`,
    );
  }

  return valueText;
}

function requireCoordinate(
  value: unknown,
  label: string,
  min: number,
  max: number,
) {
  if (value === null || value === undefined || value === "") {
    throw new BadRequestException(`${label}은(는) 필수입니다.`);
  }

  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    throw new BadRequestException(`${label}은(는) 숫자로 입력하세요.`);
  }

  if (parsed < min || parsed > max) {
    throw new BadRequestException(
      `${label}은(는) ${min}부터 ${max} 사이의 숫자로 입력하세요.`,
    );
  }

  return parsed;
}

function normalizeOperationMode(value: unknown) {
  return value === "MANUAL" ? "MANUAL" : "SENSOR";
}

function buildParkingLotData(dto: ParkingLotPayloadInput) {
  const lat = requireCoordinate(dto.lat, "위도", -90, 90);
  const lng = requireCoordinate(dto.lng, "경도", -180, 180);

  return {
    code: requireText(dto.code, "주차장 코드"),
    name: requireText(dto.name, "주차장명"),
    region: normalizeRegion(dto.region),
    district: normalizeDistrict(dto.district),
    address: requireText(dto.address, "주소", 5),
    lat,
    lng,
    centerLat: lat,
    centerLng: lng,
    representative: optionalText(dto.representative),
    contact: optionalText(dto.contact),
    operationMode: normalizeOperationMode(dto.operationMode),
  };
}

function buildParkingLotUpdateData(
  current: ParkingLotPayloadInput,
  dto: ParkingLotPayloadInput,
) {
  return buildParkingLotData({
    code: dto.code ?? current.code,
    name: dto.name ?? current.name,
    region: dto.region ?? current.region,
    district: dto.district ?? current.district,
    address: dto.address ?? current.address,
    lat: dto.lat ?? current.lat,
    lng: dto.lng ?? current.lng,
    representative: dto.representative ?? current.representative,
    contact: dto.contact ?? current.contact,
    operationMode: dto.operationMode ?? current.operationMode,
  });
}

function upperText(value: unknown) {
  return text(value).toUpperCase();
}

function parseBoolean(value: unknown, fallback: boolean) {
  const valueText = upperText(value);
  if (!valueText) return fallback;
  if (["TRUE", "Y", "YES", "1", "활성"].includes(valueText)) return true;
  if (["FALSE", "N", "NO", "0", "비활성"].includes(valueText)) return false;
  return fallback;
}

function isNumberLike(value: unknown) {
  if (value === null || value === undefined || value === "") return true;
  return Number.isFinite(Number(value));
}

function optionalNumber(value: unknown) {
  if (value === null || value === undefined || text(value) === "") {
    return null;
  }

  const parsed = Number(value);

  return Number.isFinite(parsed) ? parsed : null;
}

function isImportBooleanLike(value: unknown) {
  const normalized = upperText(value);

  return (
    normalized === "" ||
    normalized === "TRUE" ||
    normalized === "FALSE" ||
    normalized === "1" ||
    normalized === "0"
  );
}

function removeEmptyImportRows(rows: Record<string, unknown>[]) {
  return rows.filter((row) => {
    if (!row || typeof row !== "object") {
      return false;
    }

    return Object.values(row).some((value) => text(value) !== "");
  });
}

function getPrismaErrorCode(error: unknown) {
  if (!error || typeof error !== "object" || !("code" in error)) {
    return null;
  }

  const code = (
    error as {
      code?: unknown;
    }
  ).code;

  return typeof code === "string" ? code : null;
}

@Injectable()
export class LotsService {
  constructor(private readonly prisma: PrismaService) {}

  async enqueueParkingLotOperationSnapshotSync(tx: any, lot: any) {
    if (!isCloudProfile()) {
      return 0;
    }

    const links = await tx.edgeParkingLot.findMany({
      where: {
        parkingLotId: lot.id,
      },
      select: {
        edgeNodeId: true,
      },
    });

    const managementCompany = lot.managementCompanyId
      ? await tx.managementCompany.findUnique({
          where: {
            id: lot.managementCompanyId,
          },
          select: {
            id: true,
            name: true,
            code: true,
            businessNumber: true,
            representative: true,
            contact: true,
            address: true,
            memo: true,
            isActive: true,
            updatedAt: true,
          },
        })
      : null;

    const sections = await tx.parkingSection.findMany({
      where: {
        parkingLotId: lot.id,
      },
      include: {
        spaces: {
          orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        },
      },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    });

    const sectionIds = sections.map((section: any) => section.id);

    const parkingSpaceIds = sections.flatMap((section: any) =>
      section.spaces.map((space: any) => space.id),
    );

    const [
      sensorDevices,
      feePolicies,
      discountEligibilityDefinitions,
      discountPrograms,
    ] = await Promise.all([
      tx.sensorDevice.findMany({
        where: {
          OR: [
            {
              parkingLotId: lot.id,
            },
            ...(sectionIds.length > 0
              ? [
                  {
                    parkingSectionId: {
                      in: sectionIds,
                    },
                  },
                ]
              : []),
            ...(parkingSpaceIds.length > 0
              ? [
                  {
                    parkingSpaceId: {
                      in: parkingSpaceIds,
                    },
                  },
                ]
              : []),
          ],
        },
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      }),
      tx.feePolicy.findMany({
        where: {
          parkingLotId: lot.id,
        },
        include: {
          timeRules: {
            orderBy: [{ startHour: "asc" }, { endHour: "asc" }],
          },
        },
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      }),
      tx.discountEligibilityDefinition.findMany({
        orderBy: [{ displayOrder: "asc" }, { code: "asc" }],
      }),
      tx.parkingDiscountProgram.findMany({
        where: {
          parkingLotId: lot.id,
        },
        orderBy: [{ priority: "asc" }, { createdAt: "asc" }, { id: "asc" }],
      }),
    ]);

    let created = 0;

    for (const link of links) {
      const event = await tx.domainEvent.create({
        data: {
          eventId: randomUUID(),
          aggregateType: "ParkingLot",
          aggregateId: lot.id,
          eventType: "PARKING_LOT_OPERATION_SNAPSHOT_FROM_CLOUD",
          payload: {
            edgeNodeId: link.edgeNodeId,
            parkingLotId: lot.id,
            code: lot.code,
            name: lot.name,
            region: lot.region ?? null,
            district: lot.district ?? null,
            address: lot.address,
            lat: lot.lat,
            lng: lot.lng,
            centerLat: lot.centerLat,
            centerLng: lot.centerLng,
            representative: lot.representative ?? null,
            contact: lot.contact ?? null,
            operationMode: lot.operationMode,
            isActive: lot.isActive,
            managementCompanyId: lot.managementCompanyId ?? null,
            managementCompany: managementCompany
              ? {
                  id: managementCompany.id,
                  name: managementCompany.name,
                  code: managementCompany.code,
                  businessNumber: managementCompany.businessNumber ?? null,
                  representative: managementCompany.representative ?? null,
                  contact: managementCompany.contact ?? null,
                  address: managementCompany.address ?? null,
                  memo: managementCompany.memo ?? null,
                  isActive: managementCompany.isActive,
                  cloudUpdatedAt: managementCompany.updatedAt.toISOString(),
                }
              : null,
            snapshotVersion: 1,
            snapshotCreatedAt: new Date().toISOString(),

            /*
             * Cloud 센서 목록이 아직 비어 있는 주차장이
             * 있으므로 누락 센서를 Edge에서 자동 제거하지 않는다.
             */
            sensorInventoryAuthoritative: false,

            sections: sections.map((section: any) => ({
              id: section.id,
              parkingLotId: section.parkingLotId,
              name: section.name,
              code: section.code ?? null,
              centerLat: section.centerLat ?? null,
              centerLng: section.centerLng ?? null,
              polygonJson: section.polygonJson ?? null,
              isActive: section.isActive,
              cloudUpdatedAt: section.updatedAt.toISOString(),
            })),

            /*
             * status는 Edge의 실시간 현장 상태이므로
             * Snapshot에 포함하지 않는다.
             */
            spaces: sections.flatMap((section: any) =>
              section.spaces.map((space: any) => ({
                id: space.id,
                sectionId: space.sectionId,
                code: space.code,
                number: space.number ?? null,
                type: space.type,
                lat: space.lat ?? null,
                lng: space.lng ?? null,
                widthMeter: space.widthMeter ?? null,
                heightMeter: space.heightMeter ?? null,
                rotationDeg: space.rotationDeg ?? null,
                posX: space.posX ?? null,
                posY: space.posY ?? null,
                polygonJson: space.polygonJson ?? null,
                isActive: space.isActive,
                cloudUpdatedAt: space.updatedAt.toISOString(),
              })),
            ),

            sensorDevices: sensorDevices.map((sensor: any) => ({
              id: sensor.id,
              name: sensor.name,
              type: sensor.type,
              serialNumber: sensor.serialNumber,
              devEui: sensor.devEui ?? null,
              macAddress: sensor.macAddress ?? null,
              ipAddress: sensor.ipAddress ?? null,
              installLocation: sensor.installLocation ?? null,
              status: sensor.status,
              parkingLotId: sensor.parkingLotId ?? null,
              parkingSectionId: sensor.parkingSectionId ?? null,
              parkingSpaceId: sensor.parkingSpaceId ?? null,
              firmwareVersion: sensor.firmwareVersion ?? null,
              metadata: sensor.metadata ?? null,
              cloudUpdatedAt: sensor.updatedAt.toISOString(),
            })),

            feePolicies: feePolicies.map((policy: any) => ({
              id: policy.id,
              parkingLotId: policy.parkingLotId,
              code: policy.code ?? null,
              name: policy.name ?? null,
              vehicleType: policy.vehicleType,
              baseMinutes: policy.baseMinutes,
              baseFee: policy.baseFee,
              unitMinutes: policy.unitMinutes,
              unitFee: policy.unitFee,
              memberDiscountPercent: policy.memberDiscountPercent,
              dailyMax: policy.dailyMax ?? null,
              graceMinutes: policy.graceMinutes,
              exitGraceMinutes: policy.exitGraceMinutes,
              registrationGraceMinutes: policy.registrationGraceMinutes,
              registrationGraceFee: policy.registrationGraceFee,
              registrationGraceDiscountEnabled:
                policy.registrationGraceDiscountEnabled,
              authorityRegistrationGraceDiscountEnabled:
                policy.authorityRegistrationGraceDiscountEnabled,
              watcherRewardGraceFeeEnabled: policy.watcherRewardGraceFeeEnabled,
              taxType: policy.taxType,
              isActive: policy.isActive,
              validFrom: policy.validFrom?.toISOString() ?? null,
              validTo: policy.validTo?.toISOString() ?? null,
              timeRules: policy.timeRules.map((rule: any) => ({
                id: rule.id,
                startHour: rule.startHour,
                endHour: rule.endHour,
                multiplier: rule.multiplier,
              })),
              cloudUpdatedAt: policy.updatedAt.toISOString(),
            })),

            discountEligibilityDefinitions: discountEligibilityDefinitions.map(
              (definition: any) => ({
                id: definition.id,
                code: definition.code,
                name: definition.name,
                scope: definition.scope,
                description: definition.description ?? null,
                isActive: definition.isActive,
                displayOrder: definition.displayOrder,
                cloudUpdatedAt: definition.updatedAt.toISOString(),
              }),
            ),

            discountPrograms: discountPrograms.map((program: any) => ({
              id: program.id,
              parkingLotId: program.parkingLotId,
              eligibilityDefinitionId: program.eligibilityDefinitionId,
              code: program.code,
              name: program.name,
              description: program.description ?? null,
              benefitType: program.benefitType,
              benefitValue: program.benefitValue,
              priority: program.priority,
              stackable: program.stackable,
              stackableWithCoupon: program.stackableWithCoupon,
              maxDiscountAmount: program.maxDiscountAmount ?? null,
              minimumPayableAmount: program.minimumPayableAmount,
              isActive: program.isActive,
              validFrom: program.validFrom?.toISOString() ?? null,
              validUntil: program.validUntil?.toISOString() ?? null,
              cloudUpdatedAt: program.updatedAt.toISOString(),
            })),

            cloudUpdatedAt: lot.updatedAt.toISOString(),
            destination: `EDGE:${link.edgeNodeId}`,
            createdForEdgeSync: true,
          },
          occurredAt: new Date(),
        },
      });

      await tx.syncOutbox.create({
        data: {
          domainEventId: event.id,
          destination: `EDGE:${link.edgeNodeId}`,
          status: "PENDING",
        },
      });

      created += 1;
    }

    return created;
  }

  private async enqueueParkingLotCreatedFromEdgeSync(
    tx: any,
    lot: any,
    user: AuthUser,
  ) {
    if (!isConnectedEdgeProfile()) {
      return null;
    }

    const sections = await tx.parkingSection.findMany({
      where: {
        parkingLotId: lot.id,
      },
      include: {
        spaces: {
          orderBy: [
            {
              createdAt: "asc",
            },
            {
              id: "asc",
            },
          ],
        },
      },
      orderBy: [
        {
          createdAt: "asc",
        },
        {
          id: "asc",
        },
      ],
    });

    const event = await tx.domainEvent.create({
      data: {
        eventId: randomUUID(),
        aggregateType: "ParkingLot",
        aggregateId: lot.id,
        eventType: "PARKING_LOT_CREATED_EDGE_SYNC_REQUIRED",
        payload: {
          parkingLotId: lot.id,
          parkingLot: {
            id: lot.id,
            code: lot.code,
            name: lot.name,
            region: lot.region ?? null,
            district: lot.district ?? null,
            address: lot.address,
            timezone: lot.timezone ?? "Asia/Seoul",
            lat: lot.lat ?? null,
            lng: lot.lng ?? null,
            centerLat: lot.centerLat ?? lot.lat ?? null,
            centerLng: lot.centerLng ?? lot.lng ?? null,
            representative: lot.representative ?? null,
            contact: lot.contact ?? null,
            managementCompanyId: lot.managementCompanyId ?? null,
            graceMinutes: lot.graceMinutes ?? 10,
            operationMode: lot.operationMode,
            isActive: lot.isActive,
          },
          sections: sections.map((section: any) => ({
            id: section.id,
            parkingLotId: section.parkingLotId,
            code: section.code ?? null,
            name: section.name,
            centerLat: section.centerLat ?? null,
            centerLng: section.centerLng ?? null,
            polygonJson: section.polygonJson ?? null,
            isActive: section.isActive,
          })),
          spaces: sections.flatMap((section: any) =>
            section.spaces.map((space: any) => ({
              id: space.id,
              sectionId: space.sectionId,
              code: space.code,
              number: space.number ?? null,
              type: space.type,
              status: space.status,
              lat: space.lat ?? null,
              lng: space.lng ?? null,
              widthMeter: space.widthMeter ?? null,
              heightMeter: space.heightMeter ?? null,
              rotationDeg: space.rotationDeg ?? null,
              posX: space.posX ?? null,
              posY: space.posY ?? null,
              polygonJson: space.polygonJson ?? null,
              isActive: space.isActive,
            })),
          ),
          createdByUserId: user.sub,
          sourceEdgeNodeId: process.env.EDGE_NODE_ID ?? null,
          createdAt: lot.createdAt?.toISOString?.() ?? new Date().toISOString(),
          destination: "CLOUD",
          createdForCloudSync: true,
        },
        occurredAt: new Date(),
      },
    });

    const outbox = await tx.syncOutbox.create({
      data: {
        domainEventId: event.id,
        destination: "CLOUD",
        status: "PENDING",
      },
    });

    return {
      eventId: event.eventId,
      outboxId: outbox.id,
      status: outbox.status,
    };
  }

  private normalizePhotos(dto: unknown) {
    const photos = (dto as { photos?: unknown }).photos;

    if (!Array.isArray(photos)) {
      return undefined;
    }

    return photos
      .filter((item): item is string => typeof item === "string")
      .map((item) => item.trim())
      .filter((item) => item.length > 0)
      .slice(0, 5);
  }

  private async getScopedParkingLotIds(user?: AuthUser) {
    if (!user?.sub || isAdmin(user)) {
      return null;
    }

    if (isManager(user)) {
      return getManagerParkingLotIds(this.prisma, user.sub);
    }

    if (isOperator(user)) {
      return getOperatorParkingLotIds(this.prisma, user.sub);
    }

    return null;
  }

  async findAll(user?: AuthUser, status: LotStatusFilter = "active") {
    const scopedParkingLotIds = await this.getScopedParkingLotIds(user);

    if (scopedParkingLotIds && scopedParkingLotIds.length === 0) {
      return [];
    }

    const statusWhere =
      status === "all"
        ? {}
        : {
            isActive: status !== "inactive",
          };

    return this.prisma.parkingLot.findMany({
      where: {
        ...statusWhere,
        ...(scopedParkingLotIds
          ? {
              id: {
                in: scopedParkingLotIds,
              },
            }
          : {}),
      },
      orderBy: {
        createdAt: "desc",
      },
      include: {
        _count: {
          select: {
            sections: true,
          },
        },
        qrCodes: {
          where: {
            qrType: "PARKING_LOT",
            isActive: true,
          },
          orderBy: {
            createdAt: "desc",
          },
          take: 1,
        },
        photos: {
          orderBy: [
            { isPrimary: "desc" },
            { sortOrder: "asc" },
            { createdAt: "asc" },
          ],
          take: 5,
        },
      },
    });
  }

  async findOne(id: string, user?: AuthUser) {
    const scopedParkingLotIds = await this.getScopedParkingLotIds(user);

    if (scopedParkingLotIds && !scopedParkingLotIds.includes(id)) {
      throw new ForbiddenException("No permission to access this parking lot.");
    }

    const lot = await this.prisma.parkingLot.findUnique({
      where: { id },
      include: {
        sections: true,
        _count: {
          select: {
            sections: true,
            sensorDevices: true,
          },
        },
        photos: {
          orderBy: [
            { isPrimary: "desc" },
            { sortOrder: "asc" },
            { createdAt: "asc" },
          ],
        },
      },
    });

    if (!lot) {
      throw new NotFoundException("Parking lot not found");
    }

    return lot;
  }

  async create(user: AuthUser, dto: CreateParkingLotDto) {
    if (!isAdmin(user) && !isManager(user)) {
      throw new ForbiddenException(
        "관리자 또는 매니저만 주차장을 생성할 수 있습니다.",
      );
    }

    const photos = this.normalizePhotos(dto);
    const lotData = buildParkingLotData(dto);

    return this.prisma.$transaction(async (tx) => {
      const lot = await tx.parkingLot.create({
        data: {
          ...lotData,
          photos: photos
            ? {
                create: photos.map((imageUrl, index) => ({
                  imageUrl,
                  sortOrder: index,
                  isPrimary: index === 0,
                })),
              }
            : undefined,
        },
        include: {
          photos: {
            orderBy: [
              { isPrimary: "desc" },
              { sortOrder: "asc" },
              { createdAt: "asc" },
            ],
          },
        },
      });

      await ensureActiveParkingLotQr(tx, lot);

      const edgeCloudSync = await this.enqueueParkingLotCreatedFromEdgeSync(
        tx,
        lot,
        user,
      );

      /*
       * Cloud와 Connected Edge에서는 주차장 생성과
       * 매니저 관리 권한을 분리한다.
       *
       * Standalone에서만 생성 매니저가 즉시 관리할 수
       * 있도록 ManagerParkingLot과 LOT scope를 부여한다.
       */
      if (isEdgeStandaloneProfile() && isManager(user)) {
        const managerProfile = await tx.managerProfile.findUnique({
          where: {
            userId: user.sub,
          },
          select: {
            userId: true,
          },
        });

        if (!managerProfile) {
          throw new BadRequestException("매니저 프로필을 찾을 수 없습니다.");
        }

        await tx.managerParkingLot.upsert({
          where: {
            managerProfileUserId_parkingLotId: {
              managerProfileUserId: managerProfile.userId,
              parkingLotId: lot.id,
            },
          },
          update: {},
          create: {
            managerProfileUserId: managerProfile.userId,
            parkingLotId: lot.id,
          },
        });

        const existingScope = await tx.userScopeBinding.findFirst({
          where: {
            userId: user.sub,
            scopeType: ScopeType.LOT,
            parkingLotId: lot.id,
          },
          select: {
            id: true,
          },
        });

        if (!existingScope) {
          await tx.userScopeBinding.create({
            data: {
              userId: user.sub,
              scopeType: ScopeType.LOT,
              parkingLotId: lot.id,
            },
          });
        }
      }

      return {
        ...lot,
        managementAccess:
          isAdmin(user) || (isEdgeStandaloneProfile() && isManager(user)),
        managementAccessRequiresApproval:
          !isEdgeStandaloneProfile() && isManager(user),
        edgeCloudSync,
      };
    });
  }

  async update(id: string, dto: UpdateParkingLotDto) {
    const currentLot = await this.findOne(id);

    const photos = this.normalizePhotos(dto);
    const lotData = buildParkingLotUpdateData(currentLot, dto);

    return this.prisma.$transaction(async (tx) => {
      await tx.parkingLot.update({
        where: { id },
        data: lotData,
      });

      if (photos) {
        await tx.parkingLotPhoto.deleteMany({
          where: {
            parkingLotId: id,
          },
        });

        if (photos.length > 0) {
          await tx.parkingLotPhoto.createMany({
            data: photos.map((imageUrl, index) => ({
              parkingLotId: id,
              imageUrl,
              sortOrder: index,
              isPrimary: index === 0,
            })),
          });
        }
      }

      const updatedLot = await tx.parkingLot.findUnique({
        where: { id },
        include: {
          sections: true,
          photos: {
            orderBy: [
              { isPrimary: "desc" },
              { sortOrder: "asc" },
              { createdAt: "asc" },
            ],
          },
          _count: {
            select: {
              sections: true,
              sensorDevices: true,
            },
          },
        },
      });

      if (!updatedLot) {
        throw new NotFoundException("Parking lot not found");
      }

      await this.enqueueParkingLotOperationSnapshotSync(tx, updatedLot);

      return updatedLot;
    });
  }

  async updateStatus(id: string, isActive: boolean) {
    await this.findOne(id);

    return this.prisma.$transaction(async (tx) => {
      const updatedLot = await tx.parkingLot.update({
        where: { id },
        data: {
          isActive,
        },
      });

      await this.enqueueParkingLotOperationSnapshotSync(tx, updatedLot);

      return updatedLot;
    });
  }

  async remove(id: string) {
    return this.updateStatus(id, false);
  }

  async importRows(
    user: AuthUser | undefined,
    rows: Record<string, unknown>[],
  ) {
    if (!user || (!isAdmin(user) && !isManager(user))) {
      throw new ForbiddenException(
        "관리자 또는 매니저만 주차장 Excel 파일을 등록할 수 있습니다.",
      );
    }

    const normalizedRows = removeEmptyImportRows(rows);

    const validation = await this.validateImportRows(user, normalizedRows);

    if (!validation.ok) {
      throw new BadRequestException({
        message: "Excel 검증 오류가 있어 등록할 수 없습니다.",
        validation,
      });
    }

    type ImportSpace = {
      code: string;
      number: string;
      type: SpaceType;
      status: SpaceStatus;
      lat: number | null;
      lng: number | null;
      widthMeter: number | null;
      heightMeter: number | null;
      rotationDeg: number | null;
      posX: number | null;
      posY: number | null;
      isActive: boolean;
    };

    type ImportSection = {
      code: string;
      name: string;
      centerLat: number | null;
      centerLng: number | null;
      isActive: boolean;
      spaces: ImportSpace[];
    };

    type ImportLot = {
      code: string;
      name: string;
      operationMode: string;
      region: string | null;
      district: string | null;
      address: string;
      timezone: string;
      lat: number | null;
      lng: number | null;
      centerLat: number | null;
      centerLng: number | null;
      representative: string | null;
      contact: string | null;
      graceMinutes: number;
      isActive: boolean;
      sections: Map<string, ImportSection>;
    };

    const groupedLots = new Map<string, ImportLot>();

    for (const row of normalizedRows) {
      const lotCode = text(row.lotCode);

      const sectionCode = text(row.sectionCode);

      let lot = groupedLots.get(lotCode);

      if (!lot) {
        const lotLat = optionalNumber(row.lotLat);

        const lotLng = optionalNumber(row.lotLng);

        lot = {
          code: lotCode,
          name: text(row.lotName),
          operationMode: upperText(row.operationMode),
          region: normalizeRegion(row.region),
          district: normalizeDistrict(row.district),
          address: text(row.address),
          timezone: optionalText(row.timezone) ?? "Asia/Seoul",
          lat: lotLat,
          lng: lotLng,
          centerLat: optionalNumber(row.centerLat) ?? lotLat,
          centerLng: optionalNumber(row.centerLng) ?? lotLng,
          representative: optionalText(row.representative),
          contact: optionalText(row.contact),
          graceMinutes: Math.max(
            0,
            Math.floor(optionalNumber(row.graceMinutes) ?? 10),
          ),
          isActive: parseBoolean(row.lotIsActive, true),
          sections: new Map<string, ImportSection>(),
        };

        groupedLots.set(lotCode, lot);
      }

      let section = lot.sections.get(sectionCode);

      if (!section) {
        section = {
          code: sectionCode,
          name: text(row.sectionName),
          centerLat: optionalNumber(row.sectionCenterLat),
          centerLng: optionalNumber(row.sectionCenterLng),
          isActive: parseBoolean(row.sectionIsActive, true),
          spaces: [],
        };

        lot.sections.set(sectionCode, section);
      }

      section.spaces.push({
        code: text(row.spaceCode),
        number: text(row.spaceNumber),
        type: (upperText(row.spaceType) || "REGULAR") as SpaceType,
        status: (upperText(row.spaceStatus) || "EMPTY") as SpaceStatus,
        lat: optionalNumber(row.spaceLat),
        lng: optionalNumber(row.spaceLng),
        widthMeter: optionalNumber(row.widthMeter),
        heightMeter: optionalNumber(row.heightMeter),
        rotationDeg: optionalNumber(row.rotationDeg),
        posX: optionalNumber(row.posX),
        posY: optionalNumber(row.posY),
        isActive: parseBoolean(row.spaceIsActive, false),
      });
    }

    try {
      return await this.prisma.$transaction(
        async (tx) => {
          const creatorUser = await tx.user.findUnique({
            where: {
              id: user.sub,
            },
            select: {
              id: true,
              managementCompanyId: true,
            },
          });

          if (!creatorUser) {
            throw new BadRequestException(
              "주차장 등록자 계정을 찾을 수 없습니다.",
            );
          }

          let creatorManagementCompanyId =
            creatorUser.managementCompanyId ?? null;

          let standaloneManagerUserId: string | null = null;

          if (isManager(user)) {
            const managerProfile = await tx.managerProfile.findUnique({
              where: {
                userId: user.sub,
              },
              select: {
                userId: true,
                managementCompanyId: true,
              },
            });

            if (!managerProfile) {
              throw new BadRequestException(
                "매니저 프로필을 찾을 수 없습니다.",
              );
            }

            creatorManagementCompanyId =
              managerProfile.managementCompanyId ?? creatorManagementCompanyId;

            if (isEdgeStandaloneProfile()) {
              standaloneManagerUserId = managerProfile.userId;
            }
          }

          const importLotCodes = Array.from(groupedLots.keys());

          const conflictingLots = await tx.parkingLot.findMany({
            where: {
              code: {
                in: importLotCodes,
              },
            },
            select: {
              code: true,
              name: true,
            },
          });

          if (conflictingLots.length > 0) {
            throw new BadRequestException(
              "이미 등록된 주차장 코드가 있습니다: " +
                conflictingLots
                  .map((item) => `${item.code} (${item.name})`)
                  .join(", "),
            );
          }

          const importedItems = [];

          for (const lotInput of groupedLots.values()) {
            const lot = await tx.parkingLot.create({
              data: {
                code: lotInput.code,
                name: lotInput.name,
                managementCompanyId: creatorManagementCompanyId,
                operationMode: lotInput.operationMode,
                region: lotInput.region,
                district: lotInput.district,
                address: lotInput.address,
                timezone: lotInput.timezone,
                lat: lotInput.lat,
                lng: lotInput.lng,
                centerLat: lotInput.centerLat,
                centerLng: lotInput.centerLng,
                representative: lotInput.representative,
                contact: lotInput.contact,
                graceMinutes: lotInput.graceMinutes,
                isActive: lotInput.isActive,
              },
            });

            await ensureActiveParkingLotQr(tx, lot);

            let sectionCount = 0;
            let spaceCount = 0;

            for (const sectionInput of lotInput.sections.values()) {
              const section = await tx.parkingSection.create({
                data: {
                  parkingLotId: lot.id,
                  code: sectionInput.code,
                  name: sectionInput.name,
                  centerLat: sectionInput.centerLat,
                  centerLng: sectionInput.centerLng,
                  isActive: sectionInput.isActive,
                },
              });

              sectionCount += 1;

              if (sectionInput.spaces.length > 0) {
                await tx.parkingSpace.createMany({
                  data: sectionInput.spaces.map((spaceInput) => ({
                    sectionId: section.id,
                    code: spaceInput.code,
                    number: spaceInput.number,
                    type: spaceInput.type,
                    status: spaceInput.status,
                    lat: spaceInput.lat,
                    lng: spaceInput.lng,
                    widthMeter: spaceInput.widthMeter,
                    heightMeter: spaceInput.heightMeter,
                    rotationDeg: spaceInput.rotationDeg,
                    posX: spaceInput.posX,
                    posY: spaceInput.posY,
                    isActive: spaceInput.isActive,
                  })),
                });

                spaceCount += sectionInput.spaces.length;
              }
            }

            if (standaloneManagerUserId) {
              await tx.managerParkingLot.upsert({
                where: {
                  managerProfileUserId_parkingLotId: {
                    managerProfileUserId: standaloneManagerUserId,
                    parkingLotId: lot.id,
                  },
                },
                update: {},
                create: {
                  managerProfileUserId: standaloneManagerUserId,
                  parkingLotId: lot.id,
                },
              });

              const existingScope = await tx.userScopeBinding.findFirst({
                where: {
                  userId: standaloneManagerUserId,
                  scopeType: ScopeType.LOT,
                  parkingLotId: lot.id,
                },
                select: {
                  id: true,
                },
              });

              if (!existingScope) {
                await tx.userScopeBinding.create({
                  data: {
                    userId: standaloneManagerUserId,
                    scopeType: ScopeType.LOT,
                    parkingLotId: lot.id,
                  },
                });
              }
            }

            const edgeCloudSync =
              await this.enqueueParkingLotCreatedFromEdgeSync(tx, lot, user);

            importedItems.push({
              id: lot.id,
              code: lot.code,
              name: lot.name,
              sectionCount,
              spaceCount,
              managementAccess:
                isAdmin(user) || Boolean(standaloneManagerUserId),
              managementAccessRequiresApproval:
                !isEdgeStandaloneProfile() && isManager(user),
              edgeCloudSync,
            });
          }

          return {
            ok: true,
            summary: {
              rowCount: validation.summary.rowCount,
              lotCount: importedItems.length,
              sectionCount: importedItems.reduce(
                (total, item) => total + item.sectionCount,
                0,
              ),
              spaceCount: importedItems.reduce(
                (total, item) => total + item.spaceCount,
                0,
              ),
            },
            warnings: validation.warnings,
            items: importedItems,
          };
        },
        {
          maxWait: 10_000,
          timeout: 120_000,
        },
      );
    } catch (error) {
      const prismaCode = getPrismaErrorCode(error);

      if (prismaCode === "P2002") {
        throw new BadRequestException(
          "동일한 주차장·구역·주차면 코드가 다른 등록과 충돌했습니다. Excel을 다시 검증한 뒤 등록해 주세요.",
        );
      }

      if (prismaCode === "P2028") {
        throw new BadRequestException(
          "Excel 등록 처리 시간이 초과되었습니다. 파일을 여러 개로 나누어 다시 등록해 주세요.",
        );
      }

      if (prismaCode === "P2034") {
        throw new BadRequestException(
          "다른 등록 작업과 충돌했습니다. 잠시 후 Excel을 다시 검증하고 등록해 주세요.",
        );
      }

      throw error;
    }
  }

  async validateImportRows(
    user: AuthUser | undefined,
    rows: Record<string, unknown>[],
  ) {
    if (!user || (!isAdmin(user) && !isManager(user))) {
      throw new ForbiddenException(
        "관리자 또는 매니저만 주차장 Excel 파일을 검증할 수 있습니다.",
      );
    }

    if (!Array.isArray(rows)) {
      throw new BadRequestException("Excel rows must be an array.");
    }

    const normalizedRows = removeEmptyImportRows(rows);

    if (normalizedRows.length === 0) {
      throw new BadRequestException("Excel에 등록할 데이터 행이 없습니다.");
    }

    if (normalizedRows.length > 5000) {
      throw new BadRequestException(
        "Excel은 한 번에 최대 5,000개의 유효 데이터 행까지 등록할 수 있습니다.",
      );
    }

    const errors: ImportError[] = [];
    const warnings: ImportError[] = [];

    const requiredFields = [
      "lotCode",
      "lotName",
      "operationMode",
      "region",
      "district",
      "address",
      "graceMinutes",
      "sectionCode",
      "sectionName",
      "spaceCode",
      "spaceNumber",
    ];

    const optionalHeaders = [
      "timezone",
      "lotLat",
      "lotLng",
      "centerLat",
      "centerLng",
      "representative",
      "contact",
      "lotIsActive",
      "sectionCenterLat",
      "sectionCenterLng",
      "sectionIsActive",
      "spaceType",
      "spaceStatus",
      "spaceLat",
      "spaceLng",
      "widthMeter",
      "heightMeter",
      "rotationDeg",
      "posX",
      "posY",
      "spaceIsActive",
    ];

    const allowedHeaders = new Set([...requiredFields, ...optionalHeaders]);

    const presentHeaders = new Set(
      normalizedRows.flatMap((row) =>
        Object.keys(row)
          .map((header) => header.trim())
          .filter(Boolean),
      ),
    );

    for (const requiredHeader of requiredFields) {
      if (!presentHeaders.has(requiredHeader)) {
        errors.push({
          row: 1,
          field: requiredHeader,
          message: `필수 Excel 헤더가 없습니다: ${requiredHeader}`,
        });
      }
    }

    for (const presentHeader of presentHeaders) {
      if (!allowedHeaders.has(presentHeader)) {
        warnings.push({
          row: 1,
          field: presentHeader,
          message: `지원하지 않는 추가 헤더입니다. 등록 시 무시됩니다: ${presentHeader}`,
        });
      }
    }

    const allowedOperationModes = new Set(["SENSOR", "MANUAL"]);
    const allowedSpaceTypes = new Set(Object.values(SpaceType));
    const allowedSpaceStatuses = new Set(Object.values(SpaceStatus));
    type ImportComparisonRecord = {
      rowNumber: number;
      values: Record<string, string>;
    };

    const lotByCode = new Map<string, ImportComparisonRecord>();

    const sectionByKey = new Map<string, ImportComparisonRecord>();

    const spaceKeys = new Set<string>();
    const duplicateSpaceKeys = new Set<string>();

    const comparableNumber = (value: unknown) => {
      const parsed = optionalNumber(value);

      return parsed === null ? "" : String(parsed);
    };

    const comparableBoolean = (value: unknown, fallback: boolean) =>
      String(parseBoolean(value, fallback));

    const addConsistencyErrors = (
      previous: ImportComparisonRecord,
      current: ImportComparisonRecord,
      keyDescription: string,
    ) => {
      for (const [field, currentValue] of Object.entries(current.values)) {
        const previousValue = previous.values[field];

        if (previousValue !== currentValue) {
          errors.push({
            row: current.rowNumber,
            field,
            message:
              `${keyDescription}의 ${field} 값이 ` +
              `${previous.rowNumber}행과 다릅니다.`,
          });
        }
      }
    };

    normalizedRows.forEach((row, index) => {
      const rowNumber = index + 2;

      for (const field of requiredFields) {
        if (!text(row[field])) {
          errors.push({
            row: rowNumber,
            field,
            message: `${field} 값은 필수입니다.`,
          });
        }
      }

      const lotCode = text(row.lotCode);
      const lotName = text(row.lotName);
      const operationMode = upperText(row.operationMode);
      const normalizedRegion = normalizeSidoName(row.region);

      if (text(row.region) && normalizedRegion !== text(row.region)) {
        warnings.push({
          row: rowNumber,
          field: "region",
          message: `시/도 값이 ${text(row.region)}에서 ${normalizedRegion}(으)로 정규화됩니다.`,
        });
      }

      const sectionCode = text(row.sectionCode);
      const sectionName = text(row.sectionName);
      const spaceCode = text(row.spaceCode);
      const spaceType = upperText(row.spaceType) || "REGULAR";
      const spaceStatus = upperText(row.spaceStatus) || "EMPTY";

      if (operationMode && !allowedOperationModes.has(operationMode)) {
        errors.push({
          row: rowNumber,
          field: "operationMode",
          message: "operationMode는 SENSOR 또는 MANUAL만 입력할 수 있습니다.",
        });
      }

      if (lotCode) {
        const currentLot: ImportComparisonRecord = {
          rowNumber,
          values: {
            lotName,
            operationMode,
            region: normalizedRegion,
            district: text(row.district),
            address: text(row.address),
            timezone: optionalText(row.timezone) ?? "Asia/Seoul",
            lotLat: comparableNumber(row.lotLat),
            lotLng: comparableNumber(row.lotLng),
            centerLat:
              comparableNumber(row.centerLat) || comparableNumber(row.lotLat),
            centerLng:
              comparableNumber(row.centerLng) || comparableNumber(row.lotLng),
            representative: optionalText(row.representative) ?? "",
            contact: optionalText(row.contact) ?? "",
            graceMinutes: comparableNumber(row.graceMinutes),
            lotIsActive: comparableBoolean(row.lotIsActive, true),
          },
        };

        const previous = lotByCode.get(lotCode);

        if (previous) {
          addConsistencyErrors(
            previous,
            currentLot,
            `같은 lotCode(${lotCode})`,
          );
        } else {
          lotByCode.set(lotCode, currentLot);
        }
      }

      if (lotCode && sectionCode) {
        const sectionKey = `${lotCode}::${sectionCode}`;

        const currentSection: ImportComparisonRecord = {
          rowNumber,
          values: {
            sectionName,
            sectionCenterLat: comparableNumber(row.sectionCenterLat),
            sectionCenterLng: comparableNumber(row.sectionCenterLng),
            sectionIsActive: comparableBoolean(row.sectionIsActive, true),
          },
        };

        const previous = sectionByKey.get(sectionKey);

        if (previous) {
          addConsistencyErrors(
            previous,
            currentSection,
            `같은 lotCode/sectionCode(${sectionKey})`,
          );
        } else {
          sectionByKey.set(sectionKey, currentSection);
        }
      }

      if (lotCode && sectionCode && spaceCode) {
        const spaceKey = `${lotCode}::${sectionCode}::${spaceCode}`;

        if (spaceKeys.has(spaceKey)) {
          duplicateSpaceKeys.add(spaceKey);
          errors.push({
            row: rowNumber,
            field: "spaceCode",
            message: `Excel 안에서 주차면 코드가 중복됩니다: ${spaceKey}`,
          });
        }

        spaceKeys.add(spaceKey);
      }

      if (spaceType && !allowedSpaceTypes.has(spaceType as SpaceType)) {
        errors.push({
          row: rowNumber,
          field: "spaceType",
          message: `허용되지 않는 spaceType입니다: ${spaceType}`,
        });
      }

      if (
        spaceStatus &&
        !allowedSpaceStatuses.has(spaceStatus as SpaceStatus)
      ) {
        errors.push({
          row: rowNumber,
          field: "spaceStatus",
          message: `허용되지 않는 spaceStatus입니다: ${spaceStatus}`,
        });
      }

      for (const field of [
        "lotLat",
        "lotLng",
        "centerLat",
        "centerLng",
        "sectionCenterLat",
        "sectionCenterLng",
        "spaceLat",
        "spaceLng",
        "widthMeter",
        "heightMeter",
        "rotationDeg",
        "posX",
        "posY",
        "graceMinutes",
      ]) {
        if (!isNumberLike(row[field])) {
          errors.push({
            row: rowNumber,
            field,
            message: `${field} 값은 숫자 형식이어야 합니다.`,
          });
        }
      }

      for (const field of ["lotIsActive", "sectionIsActive", "spaceIsActive"]) {
        if (!isImportBooleanLike(row[field])) {
          errors.push({
            row: rowNumber,
            field,
            message: `${field} 값은 TRUE, FALSE, 1, 0 중 하나여야 합니다.`,
          });
        }
      }

      const latitudeFields = [
        "lotLat",
        "centerLat",
        "sectionCenterLat",
        "spaceLat",
      ];

      for (const field of latitudeFields) {
        const value = optionalNumber(row[field]);

        if (value !== null && (value < -90 || value > 90)) {
          errors.push({
            row: rowNumber,
            field,
            message: `${field} 값은 -90 이상 90 이하여야 합니다.`,
          });
        }
      }

      const longitudeFields = [
        "lotLng",
        "centerLng",
        "sectionCenterLng",
        "spaceLng",
      ];

      for (const field of longitudeFields) {
        const value = optionalNumber(row[field]);

        if (value !== null && (value < -180 || value > 180)) {
          errors.push({
            row: rowNumber,
            field,
            message: `${field} 값은 -180 이상 180 이하여야 합니다.`,
          });
        }
      }

      const coordinatePairs = [
        ["lotLat", "lotLng"],
        ["centerLat", "centerLng"],
        ["sectionCenterLat", "sectionCenterLng"],
        ["spaceLat", "spaceLng"],
      ] as const;

      for (const [latitudeField, longitudeField] of coordinatePairs) {
        const hasLatitude = text(row[latitudeField]) !== "";

        const hasLongitude = text(row[longitudeField]) !== "";

        if (hasLatitude !== hasLongitude) {
          errors.push({
            row: rowNumber,
            field: hasLatitude ? longitudeField : latitudeField,
            message: `${latitudeField}와 ${longitudeField}는 함께 입력해야 합니다.`,
          });
        }
      }

      const graceMinutes = optionalNumber(row.graceMinutes);

      if (
        graceMinutes !== null &&
        (graceMinutes < 0 || !Number.isInteger(graceMinutes))
      ) {
        errors.push({
          row: rowNumber,
          field: "graceMinutes",
          message: "graceMinutes는 0 이상의 정수여야 합니다.",
        });
      }

      for (const field of ["widthMeter", "heightMeter"]) {
        const value = optionalNumber(row[field]);

        if (value !== null && value <= 0) {
          errors.push({
            row: rowNumber,
            field,
            message: `${field} 값은 0보다 커야 합니다.`,
          });
        }
      }

      if (!text(row.spaceIsActive)) {
        warnings.push({
          row: rowNumber,
          field: "spaceIsActive",
          message: "spaceIsActive가 비어 있어 기본값 FALSE로 검증합니다.",
        });
      }

      parseBoolean(row.lotIsActive, true);
      parseBoolean(row.sectionIsActive, true);
      parseBoolean(row.spaceIsActive, false);
      optionalText(row.representative);
    });

    const lotCodes = Array.from(lotByCode.keys());
    const existingLots = lotCodes.length
      ? await this.prisma.parkingLot.findMany({
          where: {
            code: {
              in: lotCodes,
            },
          },
          select: {
            code: true,
            name: true,
          },
        })
      : [];

    for (const existing of existingLots) {
      errors.push({
        row: 0,
        field: "lotCode",
        message: `이미 등록된 주차장 코드입니다: ${existing.code} (${existing.name})`,
      });
    }

    return {
      ok: errors.length === 0,
      summary: {
        rowCount: normalizedRows.length,
        lotCount: lotByCode.size,
        sectionCount: sectionByKey.size,
        spaceCount: spaceKeys.size,
        duplicateSpaceCount: duplicateSpaceKeys.size,
        existingLotCount: existingLots.length,
      },
      errors,
      warnings,
      normalizedDefaults: {
        lotIsActive: true,
        sectionIsActive: true,
        spaceIsActive: false,
        spaceType: "REGULAR",
        spaceStatus: "EMPTY",
      },
    };
  }
}
