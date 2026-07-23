type LotWithStats = {
  id: string;
  name: string;
  code: string;
  region: string | null;
  district: string | null;
  address: string | null;
  centerLat: number | null;
  centerLng: number | null;
  isActive: boolean;
  operationMode: string;
  _count?: {
    sections?: number;
  };
};

type SpaceWithRelations = {
  id: string;
  code: string;
  status: string;
  posX: number | null;
  posY: number | null;
  lat: number | null;
  lng: number | null;
  widthMeter: number | null;
  heightMeter: number | null;
  rotationDeg: number | null;
  sectionId: string;
  section: {
    id: string;
    name: string;
    parkingLotId: string;
    parkingLot: {
      id: string;
      name: string;
      code: string;
      region: string | null;
      district: string | null;
      address: string | null;
    };
  };
  sessions?: Array<{
    id: string;
    status: string;
    userId: string | null;
    exitTime: Date | null;
  }>;
};

export function mapMobileOptimizedLots(params: {
  lots: Array<
    LotWithStats & {
      totalSpaces: number;
      availableSpaces: number;
      occupiedSpaces: number;
      activeSessions: number;
      openFaultCount: number;
    }
  >;
}) {
  return params.lots.map((lot) => ({
    id: lot.id,
    name: lot.name,
    code: lot.code,
    region: lot.region,
    district: lot.district,
    address: lot.address,
    operationMode: lot.operationMode,
    lat: lot.centerLat,
    lng: lot.centerLng,
    summary: {
      totalSpaces: lot.totalSpaces,
      availableSpaces: lot.availableSpaces,
      occupiedSpaces: lot.occupiedSpaces,
      activeSessions: lot.activeSessions,
    },
    operation: {
      status: lot.isActive ? 'ACTIVE' : 'INACTIVE',
      openFaultCount: lot.openFaultCount,
    },
  }));
}

export function mapMobileOptimizedSpaces(params: {
  spaces: SpaceWithRelations[];
  recentSpaceId?: string | null;
}) {
  return params.spaces.map((space) => {
    const activeSession = (space.sessions ?? []).find(
      (session) => session.exitTime === null,
    );

    let occupancyState:
      | 'EMPTY'
      | 'OCCUPIED_REGISTERED'
      | 'OCCUPIED_UNREGISTERED' = 'EMPTY';

    if (activeSession) {
      occupancyState = activeSession.userId
        ? 'OCCUPIED_REGISTERED'
        : 'OCCUPIED_UNREGISTERED';
    }

    return {
      id: space.id,
      code: space.code,
      status: space.status,
      occupancyState,
      lotId: space.section.parkingLot.id,
      lotName: space.section.parkingLot.name,
      region: space.section.parkingLot.region,
      district: space.section.parkingLot.district,
      address: space.section.parkingLot.address,
      sectionId: space.section.id,
      sectionName: space.section.name,
      lat: space.lat,
      lng: space.lng,
      posX: space.posX,
      posY: space.posY,
      widthMeter: space.widthMeter ?? 2.5,
      heightMeter: space.heightMeter ?? 5.0,
      rotationDeg: space.rotationDeg ?? 0,
      labelVisible: true,
      isMyRecentSpace: params.recentSpaceId === space.id,
    };
  });
}