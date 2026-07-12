import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { EdgeController } from './edge.controller';
import { EdgeService } from './edge.service';
import { EdgeApiKeyGuard } from '../../common/guards/edge-api-key.guard';

@Module({
  imports: [PrismaModule],
  controllers: [EdgeController],
  providers: [
    EdgeService,
    EdgeApiKeyGuard,
  ],
  exports: [
    EdgeService,
  ],
})
export class EdgeModule {}