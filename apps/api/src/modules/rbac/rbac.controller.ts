import { Controller, Get, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { AuthUser } from '../../common/types/auth-user.type';
import { RbacService } from './rbac.service';

@Controller('rbac')
@UseGuards(JwtAuthGuard)
export class RbacController {
  constructor(private readonly rbacService: RbacService) {}

  @Get('me/access-profile')
  getMyAccessProfile(@CurrentUser() user: AuthUser) {
    return this.rbacService.getAccessProfile(user.sub);
  }
}
