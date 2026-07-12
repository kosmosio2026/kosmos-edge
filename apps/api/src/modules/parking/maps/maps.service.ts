import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@parking/db';
import { PrismaService } from '../../../prisma/prisma.service';
import { UpdateSectionMapDto } from '../dto/update-section-map.dto';
import { UpdateSpaceMapDto } from '../dto/update-space-map.dto';

@Injectable()
export class MapsService {
  constructor(private readonly prisma: PrismaService) {}

  async listSpaceTypeStyles() {
    const styles = await this.prisma.parkingSpaceTypeStyle.findMany({
      where: {
        isActive: true,
      },
      orderBy: [
        {
          displayOrder: 'asc',
        },
        {
          label: 'asc',
        },
      ],
    });

    return {
      ok: true,
      items: styles,
    };
  }


  async updateSectionMap(id: string, dto: UpdateSectionMapDto) {
    const section = await this.prisma.parkingSection.findUnique({
      where: { id },
    });

    if (!section) {
      throw new NotFoundException('Section not found');
    }

    return this.prisma.parkingSection.update({
      where: { id },
      data: {
        centerLat: dto.centerLat,
        centerLng: dto.centerLng,
        polygonJson: dto.polygonJson as any | undefined,
      },
    });
  }

  async updateSpaceMap(id: string, dto: UpdateSpaceMapDto) {
    const space = await this.prisma.parkingSpace.findUnique({
      where: { id },
    });

    if (!space) {
      throw new NotFoundException('Space not found');
    }

    return this.prisma.parkingSpace.update({
      where: { id },
      data: {
        lat: dto.lat,
        lng: dto.lng,
        posX: dto.posX,
        posY: dto.posY,
        widthMeter: dto.widthMeter,
        heightMeter: dto.heightMeter,
        rotationDeg: dto.rotationDeg,
        type: dto.type as any,
        polygonJson: dto.polygonJson as any | undefined,
      },
    });
  }
}