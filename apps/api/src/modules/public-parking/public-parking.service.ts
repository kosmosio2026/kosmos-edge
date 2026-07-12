import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class PublicParkingService {
  constructor(private readonly prisma: PrismaService) {}

  async getRegions() {
    const lots = await this.prisma.parkingLot.findMany({
      where: { isActive: true },
      select: {
        region: true,
        district: true,
      },
      orderBy: [
        { region: 'asc' },
        { district: 'asc' },
        { region: 'asc' },
        { district: 'asc' },
      ],
    });

    const map = new Map<string, Set<string>>();

    for (const lot of lots) {
      const region = lot.region || '미지정';
      const district = lot.district || '미지정';

      if (!map.has(region)) map.set(region, new Set());
      map.get(region)!.add(district);
    }

    return Array.from(map.entries()).map(([region, districtSet]) => {
      const districts = Array.from(districtSet).sort();

      return {
        region,
        districts,

        // Legacy compatibility: existing Watcher pages still read sido/sigungu.
        sido: region,
        sigungu: districts,
      };
    });
  }

  async getParkingLots(region?: string, district?: string) {
    const lots = await this.prisma.parkingLot.findMany({
      where: {
        isActive: true,
        ...(region
          ? {
              region,
            }
          : {}),
        ...(district
          ? {
              district,
            }
          : {}),
      },
      select: {
        id: true,
        name: true,
        code: true,
        region: true,
        district: true,
        address: true,
        lat: true,
        lng: true,
        centerLat: true,
        centerLng: true,
        graceMinutes: true,
        qrCodes: {
          where: {
            isActive: true,
          },
          select: {
            qrToken: true,
          },
          take: 1,
        },
      },
      orderBy: [{ region: 'asc' }, { district: 'asc' }, { name: 'asc' }],
    });

    return lots.map((lot) => {
      const normalizedRegion = lot.region || null;
      const normalizedDistrict = lot.district || null;

      return {
        id: lot.id,
        name: lot.name,
        code: lot.code,
        region: normalizedRegion,
        district: normalizedDistrict,
        address: lot.address,
        lat: lot.lat,
        lng: lot.lng,
        centerLat: lot.centerLat,
        centerLng: lot.centerLng,
        graceMinutes: lot.graceMinutes,
        qrToken: lot.qrCodes[0]?.qrToken ?? null,

        // Legacy compatibility.
        sido: normalizedRegion,
        sigungu: normalizedDistrict,
      };
    });
  }
  async sectionsByParkingLot(parkingLotId: string) {
    return this.prisma.parkingSection.findMany({
      where: {
        parkingLotId,
        isActive: true,
      },
      select: {
        id: true,
        parkingLotId: true,
        code: true,
        name: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: [
        {
          code: 'asc',
        },
        {
          createdAt: 'asc',
        },
      ],
    });
  }

}
