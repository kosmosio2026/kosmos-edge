import { Body, Controller, Get, Header, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { PERMISSIONS } from '../../common/rbac/permissions';
import { RegistrationReviewService } from './registration-review.service';

@Controller()
@UseGuards(JwtAuthGuard)
@RequirePermission(PERMISSIONS.AUTHORITY_REGISTRATION_REVIEW)
export class RegistrationReviewController {
  constructor(private readonly service: RegistrationReviewService) {}

  @Get('admin/registration-proxy-logs')
  listAdmin(@Query() query: any) {
    return this.service.listForAdmin(query);
  }

  @Get('admin/registration-proxy-logs/stats')
  statsAdmin(@Query() query: any) {
    return this.service.statsForAdmin(query);
  }

  @Get('admin/registration-proxy-logs/export.csv')
  @Header('content-type', 'text/csv; charset=utf-8')
  exportAdminCsv(@Query() query: any) {
    return this.service.exportCsvForAdmin(query);
  }

  @Get('admin/registration-proxy-logs/:id')
  getAdminDetail(@Param('id') id: string) {
    return this.service.getDetailForAdmin(id);
  }

  @Post('admin/registration-proxy-logs/:id/review')
  reviewAdmin(@Req() req: any, @Param('id') id: string, @Body() body: any) {
    return this.service.reviewForAdmin(req.user?.sub ?? req.user?.id, id, body);
  }

  @Post('admin/registration-proxy-logs/:id/correct')
  correctAdmin(@Req() req: any, @Param('id') id: string, @Body() body: any) {
    return this.service.correctForAdmin(req.user?.sub ?? req.user?.id, id, body);
  }

  @Get('manager/registration-proxy-logs')
  listManager(@Req() req: any, @Query() query: any) {
    return this.service.listForManager(req.user?.sub ?? req.user?.id, query);
  }

  @Get('manager/registration-proxy-logs/stats')
  statsManager(@Req() req: any, @Query() query: any) {
    return this.service.statsForManager(req.user?.sub ?? req.user?.id, query);
  }

  @Get('manager/registration-proxy-logs/export.csv')
  @Header('content-type', 'text/csv; charset=utf-8')
  exportManagerCsv(@Req() req: any, @Query() query: any) {
    return this.service.exportCsvForManager(req.user?.sub ?? req.user?.id, query);
  }

  @Get('manager/registration-proxy-logs/:id')
  getManagerDetail(@Req() req: any, @Param('id') id: string) {
    return this.service.getDetailForManager(req.user?.sub ?? req.user?.id, id);
  }

  @Post('manager/registration-proxy-logs/:id/review')
  reviewManager(@Req() req: any, @Param('id') id: string, @Body() body: any) {
    return this.service.reviewForManager(req.user?.sub ?? req.user?.id, id, body);
  }

  @Post('manager/registration-proxy-logs/:id/correct')
  correctManager(@Req() req: any, @Param('id') id: string, @Body() body: any) {
    return this.service.correctForManager(req.user?.sub ?? req.user?.id, id, body);
  }
}
