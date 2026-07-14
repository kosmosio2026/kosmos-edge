import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { EdgeNodesController } from './edge-nodes.controller';
import { EdgeNodesService } from './edge-nodes.service';

@Module({
  imports: [PrismaModule],
  controllers: [EdgeNodesController],
  providers: [EdgeNodesService],
})
export class EdgeNodesModule {}
