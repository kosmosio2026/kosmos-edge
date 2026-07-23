import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { ManagementCompaniesService } from './management-companies.service';

@Controller('management-companies')
@UseGuards(JwtAuthGuard)
export class ManagementCompaniesController {
  constructor(
    private readonly managementCompaniesService: ManagementCompaniesService,
  ) {}

  @Get()
  findAll() {
    return this.managementCompaniesService.findAll();
  }

  @Get(':companyId')
  findOne(@Param('companyId') companyId: string) {
    return this.managementCompaniesService.findOne(companyId);
  }

  @Get(':companyId/parking-lots')
  findParkingLots(@Param('companyId') companyId: string) {
    return this.managementCompaniesService.findParkingLots(companyId);
  }

  @Get(':companyId/managers')
  findManagers(@Param('companyId') companyId: string) {
    return this.managementCompaniesService.findManagers(companyId);
  }
}
