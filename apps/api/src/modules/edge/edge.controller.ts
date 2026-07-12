import { Controller, Get, UseGuards } from '@nestjs/common';
import { EdgeService } from './edge.service';
import { EdgeApiKeyGuard } from '../../common/guards/edge-api-key.guard';
import {
  CurrentEdge,
  CurrentEdgeContext,
} from '../../common/decorators/current-edge.decorator';

@Controller('edge')
@UseGuards(EdgeApiKeyGuard)
export class EdgeController {
  constructor(private readonly edgeService: EdgeService) {}

  @Get('handshake')
  handshake(
    @CurrentEdge() edge: CurrentEdgeContext,
  ) {
    return this.edgeService.handshake(edge.edgeNodeId);
  }
}