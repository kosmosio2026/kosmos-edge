import {
  Controller,
  Get,
  Post,
  Body,
  Query,
} from '@nestjs/common';

import { FeesService } from './fees.service';

@Controller('fees')
export class FeesController {
  constructor(private readonly service: FeesService) {}

  @Get()
  get(@Query('lotId') lotId: string) {
    return this.service.getPolicies(lotId);
  }

  @Post()
  create(@Body() dto: any) {
    return this.service.create(dto);
  }
}