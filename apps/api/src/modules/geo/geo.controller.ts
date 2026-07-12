import { Controller, Get, Query } from '@nestjs/common';
import { GeoService } from './geo.service';

@Controller('geo')
export class GeoController {
  constructor(private readonly geoService: GeoService) {}

  @Get('address/search')
  searchAddress(@Query('query') query: string) {
    return this.geoService.searchAddress(query);
  }
}