import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { PermissionGuard } from '../../../common/guards/permission.guard';
import { RequirePermission } from '../../../common/decorators/require-permission.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { SectionsService } from './sections.service';
import { CreateSectionDto } from './dto/create-section.dto';
import { UpdateSectionDto } from './dto/update-section.dto';
import { SectionListQueryDto } from './queries/section-list-query.dto';
import type { AuthUser } from '../../../common/types/auth-user.type';

@Controller('facilities/sections')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class SectionsController {
  constructor(private readonly sectionsService: SectionsService) {}

  @Get()
  @RequirePermission('parking.section.read')
  list(@Query() query: SectionListQueryDto, @CurrentUser() user: AuthUser) {
    return this.sectionsService.list(query, user);
  }

  @Get(':id')
  @RequirePermission('parking.section.read')
  get(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.sectionsService.get(id, user);
  }

  @Post()
  @RequirePermission('parking.section.write')
  create(@Body() dto: CreateSectionDto) {
    return this.sectionsService.create(dto);
  }

  @Patch(':id')
  @RequirePermission('parking.section.write')
  update(@Param('id') id: string, @Body() dto: UpdateSectionDto) {
    return this.sectionsService.update(id, dto);
  }

  @Delete(':id')
  @RequirePermission('parking.section.write')
  remove(@Param('id') id: string) {
    return this.sectionsService.remove(id);
  }
}