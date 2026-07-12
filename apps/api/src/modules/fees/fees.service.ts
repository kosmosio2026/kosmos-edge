import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class FeesService {
  constructor(private readonly prisma: PrismaService) {}

  getPolicies(lotId: string) {
    return this.prisma.feePolicy.findMany({
      where: { parkingLotId: lotId },
      orderBy: { createdAt: 'desc' },
    });
  }

  create(dto: any) {
    return this.prisma.feePolicy.create({
      data: dto,
    });
  }
}