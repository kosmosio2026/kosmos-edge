import { Body, Controller, Get, Param, Patch, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionGuard } from '../../common/guards/permission.guard';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthUser } from '../../common/types/auth-user.type';
import { EnforcementService } from './enforcement.service';
import { ResolveViolationDto } from './dto/resolve-violation.dto';

@Controller('enforcement')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class EnforcementController {
  constructor(private readonly enforcementService: EnforcementService) {}


  @Get('unregistered-overstay')
  @RequirePermission('enforcement.manage')
  listUnregisteredOverstay() {
    return this.enforcementService.listUnregisteredOverstay();
  }

  @Get('violations')
  @RequirePermission('enforcement.manage')
  listViolations() {
    return this.enforcementService.listViolations();
  }

  @Get('violations/:sessionId')
  @RequirePermission('enforcement.manage')
  getViolationSession(@Param('sessionId') sessionId: string) {
    return this.enforcementService.getViolationSession(sessionId);
  }

  @Patch('violations/:sessionId/resolve')
  @RequirePermission('enforcement.manage')
  resolveViolation(
    @Param('sessionId') sessionId: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: ResolveViolationDto,
  ) {
    return this.enforcementService.resolveViolation(sessionId, user.sub, dto.note);
  }
}