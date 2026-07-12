import {
  Controller,
  Get,
  Post,
  Param,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Controller('collection')
export class CollectionController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('overdue')
  getOverdue() {
    return this.prisma.invoice.findMany({
      where: { status: 'OVERDUE' as any },
    });
  }

  @Post('blacklist/:userId')
  async blacklist(@Param('userId') userId: string) {
    return this.prisma.userBlacklist.create({
      data: {
        userId,
        reason: 'Overdue payments',
        isActive: true,
      },
    });
  }
}