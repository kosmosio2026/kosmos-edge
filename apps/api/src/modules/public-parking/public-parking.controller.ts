import { Controller, Get, Param, Query } from '@nestjs/common';
import { PublicParkingService } from './public-parking.service';

@Controller('public/parking-lots')
export class PublicParkingController {
  constructor(private readonly service: PublicParkingService) {}

  @Get('regions')
  getRegions(@Query('operationMode') operationMode?: string) {
    return this.service.getRegions(operationMode);
  }

  @Get()
  getParkingLots(
    @Query('region') region?: string,
    @Query('district') district?: string,
    @Query('sido') legacySido?: string,
    @Query('sigungu') legacySigungu?: string,
    @Query('operationMode') operationMode?: string) {
    return this.service.getParkingLots(
      region || legacySido,
      district || legacySigungu, operationMode);
  }

  @Get(':parkingLotId/sections')
  sectionsByParkingLot(@Param('parkingLotId') parkingLotId: string) {
    return this.service.sectionsByParkingLot(parkingLotId);
  }
}
