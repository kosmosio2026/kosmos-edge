import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

type ReviewQuery = {
  from?: string;
  to?: string;
  plate?: string;
  parkingLotId?: string;
  registrar?: string;
  reviewStatus?: string;
  lowConfidenceOnly?: string;
  mismatchOnly?: string;
};

@Injectable()
export class RegistrationReviewService {
  constructor(private readonly prisma: PrismaService) {}

  async listForAdmin(query: ReviewQuery = {}) {
    return this.list([], query, true);
  }

  async listForManager(userId: string, query: ReviewQuery = {}) {
    const lotIds = await this.getManageableParkingLotIds(userId);
    if (lotIds.length === 0) return [];

    return this.list(lotIds, query, false);
  }

  private async list(allowedLotIds: string[], query: ReviewQuery, isAdmin: boolean) {
    const where: any = {};

    if (query.from || query.to) {
      where.createdAt = {};
      if (query.from) where.createdAt.gte = new Date(query.from);
      if (query.to) where.createdAt.lte = new Date(query.to);
    }

    if (query.plate) {
      where.vehiclePlateNumber = {
        contains: query.plate.replace(/\s+/g, ''),
        mode: 'insensitive',
      };
    }

    if (query.reviewStatus) {
      const allowedReviewStatuses = [
        'PENDING_REVIEW',
        'REVIEWED',
        'NEEDS_CORRECTION',
        'REJECTED',
      ];

      if (allowedReviewStatuses.includes(query.reviewStatus)) {
        where.reviewStatus = query.reviewStatus as any;
      }
    }

    if (query.registrar) {
      const users = await this.prisma.user.findMany({
        where: {
          OR: [
            { email: { contains: query.registrar, mode: 'insensitive' } },
            { name: { contains: query.registrar, mode: 'insensitive' } },
            { phone: { contains: query.registrar, mode: 'insensitive' } },
          ],
        },
        select: { id: true },
      });

      where.performedByUserId = { in: users.map((user) => user.id) };
    }

    const logs = await this.prisma.registrationProxyLog.findMany({
      where,
      orderBy: {
        createdAt: 'desc',
      },
      take: 300,
    });

    if (logs.length === 0) return [];

    const sessionIds = [...new Set(logs.map((log) => log.parkingSessionId).filter(Boolean))];
    const userIds = [...new Set(logs.map((log) => log.performedByUserId).filter(Boolean))];

    const [sessions, users, photos, ocrResults, reviewHistories] = await Promise.all([
      this.prisma.parkingSession.findMany({
        where: {
          id: { in: sessionIds },
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
      }),
      this.prisma.user.findMany({
        where: {
          id: { in: userIds },
        },
        select: {
          id: true,
          email: true,
          name: true,
          phone: true,
        },
      }),
      this.prisma.parkingRegistrationPhoto.findMany({
        where: {
          parkingSessionId: { in: sessionIds },
        },
        orderBy: {
          createdAt: 'desc',
        },
      }),
      this.prisma.plateRecognitionResult.findMany({
        where: {
          parkingSessionId: { in: sessionIds },
        },
        orderBy: {
          createdAt: 'desc',
        },
      }),
      this.prisma.authorityRegistrationReviewHistory.findMany({
        where: {
          registrationProxyLogId: { in: logs.map((log) => log.id) },
        },
        orderBy: {
          createdAt: 'desc',
        },
        include: {
          reviewedBy: {
            select: {
              id: true,
              email: true,
              name: true,
              phone: true,
            },
          },
        },
      }),
    ]);

    const sessionById = new Map(sessions.map((session: any) => [session.id, session]));
    const userById = new Map(users.map((user) => [user.id, user]));

    const photoBySessionId = new Map<string, any>();
    for (const photo of photos as any[]) {
      if (!photoBySessionId.has(photo.parkingSessionId)) {
        photoBySessionId.set(photo.parkingSessionId, photo);
      }
    }

    const ocrBySessionId = new Map<string, any>();
    for (const ocr of ocrResults as any[]) {
      if (!ocrBySessionId.has(ocr.parkingSessionId)) {
        ocrBySessionId.set(ocr.parkingSessionId, ocr);
      }
    }

    const reviewHistoryByLogId = new Map<string, any>();
    for (const history of reviewHistories as any[]) {
      if (!reviewHistoryByLogId.has(history.registrationProxyLogId)) {
        reviewHistoryByLogId.set(history.registrationProxyLogId, history);
      }
    }

    let result = logs.map((log) => {
      const session: any = sessionById.get(log.parkingSessionId);
      const performer = userById.get(log.performedByUserId);
      const space = session?.ParkingSpace;
      const section = space?.section;
      const lot = section?.parkingLot;
      const photo = photoBySessionId.get(log.parkingSessionId) ?? null;
      const ocr = ocrBySessionId.get(log.parkingSessionId) ?? null;
      const latestReviewHistory = reviewHistoryByLogId.get(log.id) ?? null;

      const suggested = ocr?.suggestedPlateNumber ?? null;
      const reviewed = ocr?.reviewedPlateNumber ?? log.vehiclePlateNumber ?? null;
      const mismatch =
        Boolean(suggested && reviewed) &&
        String(suggested).replace(/\s+/g, '') !== String(reviewed).replace(/\s+/g, '');

      return {
        id: log.id,
        createdAt: log.createdAt,
        performedByRole: log.performedByRole,
        performedBy: performer
          ? {
              id: performer.id,
              email: performer.email,
              name: performer.name,
              phone: performer.phone,
            }
          : null,
        parkingLot: lot
          ? {
              id: lot.id,
              name: lot.name,
              code: lot.code,
              address: lot.address,
            }
          : null,
        parkingSection: section
          ? {
              id: section.id,
              name: section.name,
              code: section.code,
            }
          : null,
        parkingSpace: space
          ? {
              id: space.id,
              code: space.code,
              status: space.status,
            }
          : null,
        parkingSession: session
          ? {
              id: session.id,
              sessionNo: session.sessionNo,
              status: session.status,
              entryTime: session.entryTime,
              registeredAt: session.registeredAt,
              plateNumber: session.plateNumber,
              contactPhone: session.contactPhone,
            }
          : null,
        vehiclePlateNumber: log.vehiclePlateNumber,
        contactPhone: log.contactPhone,
        note: log.note,
        photoRequired: log.photoRequired,
        reviewStatus: (log as any).reviewStatus ?? 'PENDING_REVIEW',
        reviewNote: (log as any).reviewNote ?? null,
        reviewedAt: (log as any).reviewedAt ?? null,
        reviewedByUserId: (log as any).reviewedByUserId ?? null,
        reviewHistories: latestReviewHistory ? [latestReviewHistory] : [],
        correctedVehiclePlateNumber: (log as any).correctedVehiclePlateNumber ?? null,
        correctedContactPhone: (log as any).correctedContactPhone ?? null,
        correctionNote: (log as any).correctionNote ?? null,
        correctedByUserId: (log as any).correctedByUserId ?? null,
        correctedAt: (log as any).correctedAt ?? null,
        imageUrl: photo?.imageUrl ?? ocr?.imageUrl ?? null,
        ocrMismatch: mismatch,
        ocrLowConfidence: typeof ocr?.confidence === 'number' ? ocr.confidence < 0.8 : false,
        ocr: ocr
          ? {
              id: ocr.id,
              provider: ocr.provider,
              mode: ocr.mode,
              country: ocr.country,
              suggestedPlateNumber: ocr.suggestedPlateNumber,
              reviewedPlateNumber: ocr.reviewedPlateNumber,
              confidence: ocr.confidence,
              candidates: ocr.candidates,
              imageUrl: ocr.imageUrl,
              createdAt: ocr.createdAt,
            }
          : null,
      };
    });

    if (!isAdmin) {
      result = result.filter((item) => item.parkingLot?.id && allowedLotIds.includes(item.parkingLot.id));
    }

    if (query.parkingLotId) {
      result = result.filter((item) => item.parkingLot?.id === query.parkingLotId);
    }

    if (query.lowConfidenceOnly === 'true') {
      result = result.filter((item) => item.ocrLowConfidence);
    }

    if (query.mismatchOnly === 'true') {
      result = result.filter((item) => item.ocrMismatch);
    }

    return result;
  }




  async exportCsvForAdmin(query: ReviewQuery) {
    const items = await this.list([], query, true);
    return this.toCsv(items);
  }

  async exportCsvForManager(userId: string, query: ReviewQuery) {
    const lotIds = await this.getManageableParkingLotIds(userId);
    if (lotIds.length === 0) {
      return this.toCsv([]);
    }

    const items = await this.list(lotIds, query, false);
    return this.toCsv(items);
  }

  private csvEscape(value: any) {
    if (value === undefined || value === null) return '';

    const text = String(value)
      .replace(/\r?\n/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    if (/[",]/.test(text)) {
      return `"${text.replace(/"/g, '""')}"`;
    }

    return text;
  }

  private formatCsvDate(value: any) {
    if (!value) return '';

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';

    const pad = (n: number) => String(n).padStart(2, '0');

    return [
      date.getFullYear(),
      pad(date.getMonth() + 1),
      pad(date.getDate()),
    ].join('-') + ' ' + [
      pad(date.getHours()),
      pad(date.getMinutes()),
      pad(date.getSeconds()),
    ].join(':');
  }

  private reviewStatusLabel(status?: string | null) {
    switch (status) {
      case 'REVIEWED':
        return '검수 완료';
      case 'NEEDS_CORRECTION':
        return '수정 필요';
      case 'REJECTED':
        return '반려';
      case 'PENDING_REVIEW':
      default:
        return '검수 대기';
    }
  }

  private toCsv(items: any[]) {
    const headers = [
      'ID',
      '직권 등록 일시',
      '주차장',
      '주차장 코드',
      '구역',
      '주차면',
      '차량번호',
      '정정 차량번호',
      '연락처',
      '정정 연락처',
      '검수 상태',
      '검수 메모',
      '검수 일시',
      '정정 메모',
      '정정 일시',
      '직권 등록자',
      '직권 등록자 이메일',
      'OCR Provider',
      'OCR Mode',
      'OCR 추천 차번',
      'OCR 최종 차번',
      'OCR Confidence',
      'OCR 불일치',
      '낮은 신뢰도',
      '이미지 URL',
    ];

    const rows = items.map((item) => {
      const ocr = item?.ocr ?? item?.latestOcr ?? null;

      return [
        item?.id,
        this.formatCsvDate(item?.createdAt),
        item?.parkingLot?.name,
        item?.parkingLot?.code,
        item?.parkingSection?.name ?? item?.parkingSection?.code,
        item?.parkingSpace?.code,
        item?.vehiclePlateNumber,
        item?.correctedVehiclePlateNumber,
        item?.contactPhone,
        item?.correctedContactPhone,
        this.reviewStatusLabel(item?.reviewStatus),
        item?.reviewNote,
        this.formatCsvDate(item?.reviewedAt),
        item?.correctionNote,
        this.formatCsvDate(item?.correctedAt),
        item?.performedBy?.name,
        item?.performedBy?.email,
        ocr?.provider,
        ocr?.mode,
        ocr?.suggestedPlateNumber,
        ocr?.reviewedPlateNumber,
        typeof ocr?.confidence === 'number' ? ocr.confidence : '',
        item?.ocrMismatch ? 'Y' : 'N',
        item?.ocrLowConfidence ? 'Y' : 'N',
        item?.imageUrl,
      ];
    });

    const lines = [
      headers.map((header) => this.csvEscape(header)).join(','),
      ...rows.map((row) => row.map((value) => this.csvEscape(value)).join(',')),
    ];

    return '\ufeff' + lines.join('\n');
  }

  async statsForAdmin(query: ReviewQuery) {
    return this.stats(query, [], true);
  }

  async statsForManager(userId: string, query: ReviewQuery) {
    const lotIds = await this.getManageableParkingLotIds(userId);
    if (lotIds.length === 0) {
      return {
        total: 0,
        pendingReview: 0,
        reviewed: 0,
        needsCorrection: 0,
        rejected: 0,
        ocrMismatch: 0,
        lowConfidence: 0,
        corrected: 0,
      };
    }

    return this.stats(query, lotIds, false);
  }

  private async stats(query: ReviewQuery, allowedLotIds: string[], isAdmin: boolean) {
    const emptyStats = {
      total: 0,
      pendingReview: 0,
      reviewed: 0,
      needsCorrection: 0,
      rejected: 0,
      ocrMismatch: 0,
      lowConfidence: 0,
      corrected: 0,
    };

    const where: any = {};

    if (query.from || query.to) {
      where.createdAt = {};

      if (query.from) {
        where.createdAt.gte = new Date(query.from);
      }

      if (query.to) {
        const to = new Date(query.to);
        to.setHours(23, 59, 59, 999);
        where.createdAt.lte = to;
      }
    }

    if (query.plate) {
      where.vehiclePlateNumber = {
        contains: query.plate.replace(/\s+/g, ''),
        mode: 'insensitive',
      };
    }

    if (query.reviewStatus) {
      const allowedReviewStatuses = [
        'PENDING_REVIEW',
        'REVIEWED',
        'NEEDS_CORRECTION',
        'REJECTED',
      ];

      if (allowedReviewStatuses.includes(query.reviewStatus)) {
        where.reviewStatus = query.reviewStatus as any;
      }
    }

    const sessionWhere: any = {};

    if (!isAdmin) {
      if (allowedLotIds.length === 0) return emptyStats;

      sessionWhere.ParkingSpace = {
        section: {
          parkingLotId: {
            in: allowedLotIds,
          },
        },
      };
    }

    if (query.parkingLotId) {
      sessionWhere.ParkingSpace = {
        ...(sessionWhere.ParkingSpace ?? {}),
        section: {
          ...((sessionWhere.ParkingSpace ?? {}).section ?? {}),
          parkingLotId: query.parkingLotId,
        },
      };
    }

    if (Object.keys(sessionWhere).length > 0) {
      const sessions = await this.prisma.parkingSession.findMany({
        where: sessionWhere,
        select: {
          id: true,
        },
      });

      const sessionIds = sessions.map((session) => session.id);

      if (sessionIds.length === 0) return emptyStats;

      where.parkingSessionId = {
        in: sessionIds,
      };
    }

    const [
      total,
      pendingReview,
      reviewed,
      needsCorrection,
      rejected,
      corrected,
      logsForOcr,
    ] = await Promise.all([
      this.prisma.registrationProxyLog.count({ where }),
      this.prisma.registrationProxyLog.count({
        where: {
          ...where,
          reviewStatus: 'PENDING_REVIEW' as any,
        },
      }),
      this.prisma.registrationProxyLog.count({
        where: {
          ...where,
          reviewStatus: 'REVIEWED' as any,
        },
      }),
      this.prisma.registrationProxyLog.count({
        where: {
          ...where,
          reviewStatus: 'NEEDS_CORRECTION' as any,
        },
      }),
      this.prisma.registrationProxyLog.count({
        where: {
          ...where,
          reviewStatus: 'REJECTED' as any,
        },
      }),
      this.prisma.registrationProxyLog.count({
        where: {
          ...where,
          correctedAt: {
            not: null,
          },
        },
      }),
      this.prisma.registrationProxyLog.findMany({
        where,
        select: {
          id: true,
          vehiclePlateNumber: true,
          correctedVehiclePlateNumber: true,
          parkingSessionId: true,
        },
      }),
    ]);

    if (logsForOcr.length === 0) {
      return {
        total,
        pendingReview,
        reviewed,
        needsCorrection,
        rejected,
        ocrMismatch: 0,
        lowConfidence: 0,
        corrected,
      };
    }

    const logIds = logsForOcr.map((log) => log.id);
    const sessionIds = Array.from(new Set(logsForOcr.map((log) => log.parkingSessionId)));

    const ocrResults = await this.prisma.plateRecognitionResult.findMany({
      where: {
        OR: [
          {
            registrationProxyLogId: {
              in: logIds,
            },
          },
          {
            parkingSessionId: {
              in: sessionIds,
            },
          },
        ],
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    const latestOcrByLogOrSession = new Map<string, any>();

    for (const ocr of ocrResults as any[]) {
      if (ocr.registrationProxyLogId && !latestOcrByLogOrSession.has(`log:${ocr.registrationProxyLogId}`)) {
        latestOcrByLogOrSession.set(`log:${ocr.registrationProxyLogId}`, ocr);
      }

      if (ocr.parkingSessionId && !latestOcrByLogOrSession.has(`session:${ocr.parkingSessionId}`)) {
        latestOcrByLogOrSession.set(`session:${ocr.parkingSessionId}`, ocr);
      }
    }

    let ocrMismatch = 0;
    let lowConfidence = 0;

    for (const log of logsForOcr as any[]) {
      const ocr =
        latestOcrByLogOrSession.get(`log:${log.id}`) ??
        latestOcrByLogOrSession.get(`session:${log.parkingSessionId}`);

      if (!ocr) continue;

      const suggested = ocr.suggestedPlateNumber;
      const reviewedPlate =
        log.correctedVehiclePlateNumber ??
        ocr.reviewedPlateNumber ??
        log.vehiclePlateNumber;

      if (
        suggested &&
        reviewedPlate &&
        String(suggested).replace(/\s+/g, '') !== String(reviewedPlate).replace(/\s+/g, '')
      ) {
        ocrMismatch += 1;
      }

      if (typeof ocr.confidence === 'number' && ocr.confidence < 0.8) {
        lowConfidence += 1;
      }
    }

    return {
      total,
      pendingReview,
      reviewed,
      needsCorrection,
      rejected,
      ocrMismatch,
      lowConfidence,
      corrected,
    };
  }

  async getDetailForAdmin(id: string) {
    return this.getDetail(id, [], true);
  }

  async getDetailForManager(userId: string, id: string) {
    const lotIds = await this.getManageableParkingLotIds(userId);
    if (lotIds.length === 0) return null;

    return this.getDetail(id, lotIds, false);
  }

  private async getDetail(id: string, allowedLotIds: string[], isAdmin: boolean) {
    const log = await this.prisma.registrationProxyLog.findUnique({
      where: { id },
    });

    if (!log) return null;

    const [session, performer, photos, ocrResults, correctionHistories, reviewHistories] = await Promise.all([
      this.prisma.parkingSession.findUnique({
        where: { id: log.parkingSessionId },
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
          invoice: {
            include: {
              payments: true,
            },
          },
        },
      }),
      this.prisma.user.findUnique({
        where: { id: log.performedByUserId },
        select: {
          id: true,
          email: true,
          name: true,
          phone: true,
        },
      }),
      this.prisma.parkingRegistrationPhoto.findMany({
        where: {
          parkingSessionId: log.parkingSessionId,
        },
        orderBy: {
          createdAt: 'desc',
        },
      }),
      this.prisma.plateRecognitionResult.findMany({
        where: {
          parkingSessionId: log.parkingSessionId,
        },
        orderBy: {
          createdAt: 'desc',
        },
      }),
      this.prisma.authorityRegistrationCorrectionHistory.findMany({
        where: {
          registrationProxyLogId: id,
        },
        include: {
          correctedBy: {
            select: {
              id: true,
              email: true,
              name: true,
              phone: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      }),
      this.prisma.authorityRegistrationReviewHistory.findMany({
        where: {
          registrationProxyLogId: id,
        },
        include: {
          reviewedBy: {
            select: {
              id: true,
              email: true,
              name: true,
              phone: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      }),
    ]);

    const space: any = (session as any)?.ParkingSpace;
    const section = space?.section;
    const lot = section?.parkingLot;

    if (!isAdmin) {
      if (!lot?.id || !allowedLotIds.includes(lot.id)) {
        return null;
      }
    }

    const latestPhoto = (photos as any[])[0] ?? null;
    const latestOcr = (ocrResults as any[])[0] ?? null;

    const suggested = latestOcr?.suggestedPlateNumber ?? null;
    const reviewed = latestOcr?.reviewedPlateNumber ?? log.vehiclePlateNumber ?? null;
    const ocrMismatch =
      Boolean(suggested && reviewed) &&
      String(suggested).replace(/\s+/g, '') !== String(reviewed).replace(/\s+/g, '');

    return {
      id: log.id,
      createdAt: log.createdAt,
      performedByRole: log.performedByRole,
      performedBy: performer
        ? {
            id: performer.id,
            email: performer.email,
            name: performer.name,
            phone: performer.phone,
          }
        : null,
      parkingLot: lot
        ? {
            id: lot.id,
            name: lot.name,
            code: lot.code,
            address: lot.address,
            region: lot.region,
            district: lot.district,
          }
        : null,
      parkingSection: section
        ? {
            id: section.id,
            name: section.name,
            code: section.code,
          }
        : null,
      parkingSpace: space
        ? {
            id: space.id,
            code: space.code,
            status: space.status,
          }
        : null,
      parkingSession: session
        ? {
            id: session.id,
            sessionNo: session.sessionNo,
            status: session.status,
            entryTime: session.entryTime,
            exitTime: session.exitTime,
            registeredAt: session.registeredAt,
            plateNumber: session.plateNumber,
            contactPhone: session.contactPhone,
            isRegistered: session.isRegistered,
            registrationStatus: session.registrationStatus,
            registrationMethod: session.registrationMethod,
            invoice: (session as any).invoice ?? null,
          }
        : null,
      vehiclePlateNumber: log.vehiclePlateNumber,
      contactPhone: log.contactPhone,
      note: log.note,
      photoRequired: log.photoRequired,
      reviewStatus: (log as any).reviewStatus ?? 'PENDING_REVIEW',
      reviewNote: (log as any).reviewNote ?? null,
      reviewedAt: (log as any).reviewedAt ?? null,
      reviewedByUserId: (log as any).reviewedByUserId ?? null,
      correctedVehiclePlateNumber: (log as any).correctedVehiclePlateNumber ?? null,
      correctedContactPhone: (log as any).correctedContactPhone ?? null,
      correctionNote: (log as any).correctionNote ?? null,
      correctedByUserId: (log as any).correctedByUserId ?? null,
      correctedAt: (log as any).correctedAt ?? null,
      correctionHistories,
      reviewHistories,
      imageUrl: latestPhoto?.imageUrl ?? latestOcr?.imageUrl ?? null,
      photos,
      ocrMismatch,
      ocrLowConfidence:
        typeof latestOcr?.confidence === 'number' ? latestOcr.confidence < 0.8 : false,
      ocrResults,
      latestOcr,
    };
  }


  async reviewForAdmin(userId: string, id: string, body: any) {
    return this.review(id, userId, body, [], true);
  }

  async reviewForManager(userId: string, id: string, body: any) {
    const lotIds = await this.getManageableParkingLotIds(userId);
    if (lotIds.length === 0) return null;

    return this.review(id, userId, body, lotIds, false);
  }

  private async review(
    id: string,
    userId: string,
    body: any,
    allowedLotIds: string[],
    isAdmin: boolean,
  ) {
    if (
      ['NEEDS_CORRECTION', 'REJECTED'].includes(body.reviewStatus) &&
      !String(body.reviewNote ?? '').trim()
    ) {
      throw new BadRequestException('수정 필요 또는 반려 처리 시 사유를 입력하세요.');
    }

    const allowedStatuses = ['PENDING_REVIEW', 'REVIEWED', 'NEEDS_CORRECTION', 'REJECTED'];
    const reviewStatus = body?.reviewStatus;

    if (!allowedStatuses.includes(reviewStatus)) {
      throw new Error('Invalid reviewStatus');
    }

    if (!isAdmin) {
      const detail = await this.getDetail(id, allowedLotIds, false);
      if (!detail) return null;
    }

    const current = await this.prisma.registrationProxyLog.findUnique({
      where: { id },
      select: {
        id: true,
        reviewStatus: true,
      },
    });

    if (!current) {
      throw new Error('Registration proxy log not found');
    }

    const updated = await this.prisma.registrationProxyLog.update({
      where: { id },
      data: {
        reviewStatus: reviewStatus as any,
        reviewNote: body?.reviewNote ?? null,
        reviewedByUserId: userId,
        reviewedAt: new Date(),
      },
    });

    await this.prisma.authorityRegistrationReviewHistory.create({
      data: {
        registrationProxyLogId: id,
        reviewedByUserId: userId,
        previousStatus: current.reviewStatus,
        newStatus: reviewStatus,
        reviewNote: body?.reviewNote ?? null,
      },
    });


    return this.getDetail(updated.id, allowedLotIds, isAdmin);
  }


  async correctForAdmin(userId: string, id: string, body: any) {
    return this.correct(id, userId, body, [], true);
  }

  async correctForManager(userId: string, id: string, body: any) {
    const lotIds = await this.getManageableParkingLotIds(userId);
    if (lotIds.length === 0) return null;

    return this.correct(id, userId, body, lotIds, false);
  }

  private async correct(
    id: string,
    userId: string,
    body: any,
    allowedLotIds: string[],
    isAdmin: boolean,
  ) {
    const detail = await this.getDetail(id, allowedLotIds, isAdmin);
    if (!detail) return null;

    const vehiclePlateNumber = String(body?.vehiclePlateNumber ?? '').trim();
    const contactPhone =
      body?.contactPhone === undefined || body?.contactPhone === null
        ? null
        : String(body.contactPhone).trim();
    const correctionNote =
      body?.correctionNote === undefined || body?.correctionNote === null
        ? null
        : String(body.correctionNote).trim();

    if (!vehiclePlateNumber) {
      throw new Error('vehiclePlateNumber is required');
    }

    const log = await this.prisma.registrationProxyLog.findUnique({
      where: { id },
    });

    if (!log) return null;

    await this.prisma.$transaction(async (tx) => {
      const session = await tx.parkingSession.findUnique({
        where: { id: log.parkingSessionId },
        select: {
          id: true,
          plateNumber: true,
          contactPhone: true,
        },
      });

      await tx.parkingSession.update({
        where: { id: log.parkingSessionId },
        data: {
          plateNumber: vehiclePlateNumber,
          contactPhone,
          updatedAt: new Date(),
        },
      });

      await tx.registrationProxyLog.update({
        where: { id },
        data: {
          correctedVehiclePlateNumber: vehiclePlateNumber,
          correctedContactPhone: contactPhone,
          correctionNote,
          correctedByUserId: userId,
          correctedAt: new Date(),
          reviewStatus: 'REVIEWED' as any,
          reviewNote: correctionNote ?? (log as any).reviewNote ?? null,
          reviewedByUserId: userId,
          reviewedAt: new Date(),
        },
      });

      await tx.authorityRegistrationCorrectionHistory.create({
        data: {
          registrationProxyLogId: id,
          parkingSessionId: log.parkingSessionId,
          correctedByUserId: userId,
          previousPlateNumber: session?.plateNumber ?? log.vehiclePlateNumber ?? null,
          newPlateNumber: vehiclePlateNumber,
          previousContactPhone: session?.contactPhone ?? log.contactPhone ?? null,
          newContactPhone: contactPhone,
          correctionNote,
        },
      });

      await tx.plateRecognitionResult.updateMany({
        where: {
          registrationProxyLogId: id,
        },
        data: {
          reviewedPlateNumber: vehiclePlateNumber,
        },
      });
    });

    return this.getDetail(id, allowedLotIds, isAdmin);
  }

  private async getManageableParkingLotIds(userId: string) {
    const ids = new Set<string>();

    const tenantUsers = await this.prisma.tenantUser.findMany({
      where: {
        userId,
        status: 'ACTIVE',
      },
      select: {
        tenantId: true,
      },
    });

    const tenantIds = tenantUsers.map((item) => item.tenantId);

    if (tenantIds.length > 0) {
      const lots = await this.prisma.parkingLot.findMany({
        where: {
          tenantId: { in: tenantIds },
        },
        select: {
          id: true,
        },
      });

      for (const lot of lots) ids.add(lot.id);
    }

    const managerLots = await this.prisma.managerParkingLot.findMany({
      where: {
        managerProfileUserId: userId,
      },
      select: {
        parkingLotId: true,
      },
    });

    for (const item of managerLots) ids.add(item.parkingLotId);

    return Array.from(ids);
  }
}
