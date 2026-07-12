import { Body, Controller, Get, Patch, Param, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { PermissionGuard } from '../../../common/guards/permission.guard';
import { RequirePermission } from '../../../common/decorators/require-permission.decorator';
import { MapsService } from './maps.service';
import { UpdateSectionMapDto } from '../dto/update-section-map.dto';
import { UpdateSpaceMapDto } from '../dto/update-space-map.dto';

@Controller('parking/maps')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class MapsController {
  constructor(private readonly mapsService: MapsService) {}

  @Get('space-type-styles')
  listSpaceTypeStyles() {
    return this.mapsService.listSpaceTypeStyles();
  }


  @Patch('sections/:id')
  @RequirePermission('parking.section.write')
  updateSectionMap(@Param('id') id: string, @Body() dto: UpdateSectionMapDto) {
    return this.mapsService.updateSectionMap(id, dto);
  }

  @Patch('spaces/:id')
  @RequirePermission('parking.space.write')
  updateSpaceMap(@Param('id') id: string, @Body() dto: UpdateSpaceMapDto) {
    return this.mapsService.updateSpaceMap(id, dto);
  }
}