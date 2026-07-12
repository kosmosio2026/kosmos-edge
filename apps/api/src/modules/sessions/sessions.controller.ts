import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthUser } from '../../common/types/auth-user.type';
import { SessionEngineService } from './session-engine.service';
import { SessionsService } from './sessions.service';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

@Controller('sessions')
@UseGuards(JwtAuthGuard)
export class SessionsController {
  constructor(
    private readonly sessionsService: SessionsService,
    private readonly sessionEngineService: SessionEngineService,
  ) {}

  @Get()
  list(
    @Query()
    query: PaginationQueryDto & {
      status?: string;
      parkingLotId?: string;
      parkingSectionId?: string;
      parkingSpaceId?: string;
    },
  ) {
    return this.sessionsService.list(query);
  }

  @Get(':id')
  getById(@Param('id') id: string) {
    return this.sessionsService.getById(id);
  }

  @Post('entry')
  @RequirePermission('session.manage')
  entry(
    @Body() dto: { parkingSpaceId: string; plateNumber?: string },
    @CurrentUser() user: AuthUser,
  ) {
    return this.sessionEngineService.entry({
      parkingSpaceId: dto.parkingSpaceId,
      plateNumber: dto.plateNumber,
      userId: user.sub,
    });
  }

  @Post(':id/register')
  @RequirePermission('session.manage')
  register(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.sessionEngineService.register(id, user.sub);
  }

  @Post(':id/exit')
  @RequirePermission('session.manage')
  exit(@Param('id') id: string) {
    return this.sessionEngineService.exit(id);
  }

  @Post('exit-by-space')
  @RequirePermission('session.manage')
  exitBySpace(@Body() dto: { parkingSpaceId: string }) {
    return this.sessionEngineService.exitBySpace(dto.parkingSpaceId);
  }
}