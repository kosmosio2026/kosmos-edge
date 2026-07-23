import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { DisplayService } from './display.service';
import { DisplayBoardScopeGuard } from './display-board-scope.guard';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionGuard } from '../../common/guards/permission.guard';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { PERMISSIONS } from '../../common/rbac/permissions';
import { UpdateDisplayBoardDto } from './dto/update-display-board.dto';
import { UpdateDisplayModulesDto } from './dto/update-display-modules.dto';
import { BrightnessCommandDto, PowerCommandDto, TestCommandDto } from './dto/device-display-command.dto';
import { UpdateDisplayLinesDto } from './dto/update-display-lines.dto';
import { CreateDisplayCommandDto } from './dto/create-display-command.dto';
import { ReportDisplayJobDto } from './dto/report-display-job.dto';

@Controller('display')
export class DisplayController {
  constructor(private readonly displayService: DisplayService) {}

  @Get('boards')
  @UseGuards(JwtAuthGuard, PermissionGuard, DisplayBoardScopeGuard)
  @RequirePermission(PERMISSIONS.DISPLAY_READ)
  listBoards(
    @Query('parkingLotId') parkingLotId: string | undefined,
    @Req() req: any,
  ) {
    return this.displayService.listBoards(
      parkingLotId,
      req.user,
    );
  }

  // Legacy compatibility for existing admin dashboard/display pages.
  // New model uses display boards, but older web code calls /display/controllers.
  @Get('controllers')
  @UseGuards(JwtAuthGuard, PermissionGuard, DisplayBoardScopeGuard)
  @RequirePermission(PERMISSIONS.DISPLAY_READ)
  getLegacyControllers(
    @Query('parkingLotId') parkingLotId: string | undefined,
    @Req() req: any,
  ) {
    return this.displayService.listBoards(
      parkingLotId,
      req.user,
    );
  }


  @Get('boards/:id')
  @UseGuards(JwtAuthGuard, PermissionGuard, DisplayBoardScopeGuard)
  @RequirePermission(PERMISSIONS.DISPLAY_READ)
  getBoard(@Param('id') id: string) {
    return this.displayService.getBoard(id);
  }

  @Get('boards/:id/preview')
  @UseGuards(JwtAuthGuard, PermissionGuard, DisplayBoardScopeGuard)
  @RequirePermission(PERMISSIONS.DISPLAY_READ)
  previewBoard(@Param('id') id: string) {
    return this.displayService.previewBoard(id);
  }

  @Post('boards/:id/commands/brightness')
  @UseGuards(JwtAuthGuard, PermissionGuard, DisplayBoardScopeGuard)
  @RequirePermission(PERMISSIONS.DISPLAY_COMMAND)
  sendBrightnessCommand(
    @Param('id') id: string,
    @Body() dto: BrightnessCommandDto,
    @Req() req: any,
  ) {
    return this.displayService.sendBrightnessCommand(id, dto.brightness, req.user?.id);
  }

  @Post('boards/:id/commands/power')
  @UseGuards(JwtAuthGuard, PermissionGuard, DisplayBoardScopeGuard)
  @RequirePermission(PERMISSIONS.DISPLAY_COMMAND)
  sendPowerCommand(
    @Param('id') id: string,
    @Body() dto: PowerCommandDto,
    @Req() req: any,
  ) {
    return this.displayService.sendPowerCommand(id, dto.powerOn, req.user?.id);
  }

  @Post('boards/:id/commands/save')
  @UseGuards(JwtAuthGuard, PermissionGuard, DisplayBoardScopeGuard)
  @RequirePermission(PERMISSIONS.DISPLAY_COMMAND)
  sendSaveCommand(
    @Param('id') id: string,
    @Req() req: any,
  ) {
    return this.displayService.sendSaveCommand(id, req.user?.id);
  }

  @Post('boards/:id/commands/test')
  @UseGuards(JwtAuthGuard, PermissionGuard, DisplayBoardScopeGuard)
  @RequirePermission(PERMISSIONS.DISPLAY_COMMAND)
  sendTestCommand(
    @Param('id') id: string,
    @Body() dto: TestCommandDto,
    @Req() req: any,
  ) {
    return this.displayService.sendTestCommand(id, req.user?.id);
  }

  @Patch('boards/:id/modules')
  @UseGuards(JwtAuthGuard, PermissionGuard, DisplayBoardScopeGuard)
  @RequirePermission(PERMISSIONS.DISPLAY_MANAGE)
  updateModules(
    @Param('id') id: string,
    @Body() dto: UpdateDisplayModulesDto,
  ) {
    return this.displayService.updateModules(id, dto);
  }

  @Patch('boards/:id')
  @UseGuards(JwtAuthGuard, PermissionGuard, DisplayBoardScopeGuard)
  @RequirePermission(PERMISSIONS.DISPLAY_MANAGE)
  updateBoard(@Param('id') id: string, @Body() dto: UpdateDisplayBoardDto) {
    return this.displayService.updateBoard(id, dto);
  }

  @Patch('boards/:id/lines/auto')
  @UseGuards(JwtAuthGuard, PermissionGuard, DisplayBoardScopeGuard)
  @RequirePermission(PERMISSIONS.DISPLAY_MANAGE)
  updateAutoLines(@Param('id') id: string, @Body() dto: UpdateDisplayLinesDto) {
    return this.displayService.updateLines(id, 'AUTO', dto);
  }

  @Patch('boards/:id/lines/manual')
  @UseGuards(JwtAuthGuard, PermissionGuard, DisplayBoardScopeGuard)
  @RequirePermission(PERMISSIONS.DISPLAY_MANAGE)
  updateManualLines(@Param('id') id: string, @Body() dto: UpdateDisplayLinesDto) {
    return this.displayService.updateLines(id, 'MANUAL', dto);
  }

  @Post('boards/:id/commands')
  @UseGuards(JwtAuthGuard, PermissionGuard, DisplayBoardScopeGuard)
  @RequirePermission(PERMISSIONS.DISPLAY_COMMAND)
  createCommand(@Param('id') id: string, @Body() dto: CreateDisplayCommandDto, @Req() req: any) {
    return this.displayService.createCommand(id, dto, req.user?.sub);
  }

  @Post('boards/:id/commands/publish')
  @UseGuards(JwtAuthGuard, PermissionGuard, DisplayBoardScopeGuard)
  @RequirePermission(PERMISSIONS.DISPLAY_COMMAND)
  publish(@Param('id') id: string, @Req() req: any) {
    return this.displayService.publish(id, req.user?.sub);
  }

  @Post('boards/:id/commands/manual-mode')
  @UseGuards(JwtAuthGuard, PermissionGuard, DisplayBoardScopeGuard)
  @RequirePermission(PERMISSIONS.DISPLAY_MANAGE)
  manualMode(
    @Param('id') id: string,
    @Body() body: UpdateDisplayLinesDto & { reason?: string },
    @Req() req: any,
  ) {
    return this.displayService.setManualMode(id, { lines: body.lines }, body.reason, req.user?.sub);
  }

  @Post('boards/:id/commands/auto-mode')
  @UseGuards(JwtAuthGuard, PermissionGuard, DisplayBoardScopeGuard)
  @RequirePermission(PERMISSIONS.DISPLAY_MANAGE)
  autoMode(@Param('id') id: string, @Req() req: any) {
    return this.displayService.setAutoMode(id, req.user?.sub);
  }

  // 임시: edge 내부 display-daemon 전용 endpoint.
  // 다음 단계에서 API key guard로 잠글 예정.
  @Get('daemon/jobs')
  getDaemonJobs(@Query('daemonId') daemonId?: string) {
    return this.displayService.getDaemonJobs(daemonId);
  }

  // 임시: edge 내부 display-daemon 전용 endpoint.
  // 다음 단계에서 API key guard로 잠글 예정.
  @Post('daemon/jobs/:id/result')
  reportJobResult(@Param('id') id: string, @Body() dto: ReportDisplayJobDto) {
    return this.displayService.reportJobResult(id, dto);
  }
}
