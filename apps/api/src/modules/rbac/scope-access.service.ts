import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class ScopeAccessService {
  constructor(private readonly prisma: PrismaService) {}

  async getUserScopeFilter(userId: string) {
    const scopes = await this.prisma.userScopeBinding.findMany({
      where: { userId },
    });

    return {
      lotIds: scopes.map((s) => s.parkingLotId).filter(Boolean),
      sectionIds: scopes.map((s) => s.parkingSectionId).filter(Boolean),
      spaceIds: scopes.map((s) => s.parkingSpaceId).filter(Boolean),
      scopeTypes: scopes.map((s) => s.scopeType),
    };
  }
}