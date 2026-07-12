import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { SubscriptionsService } from './subscriptions.service';

@Controller('subscriptions')
export class SubscriptionsController {
  constructor(
    private readonly subscriptionsService: SubscriptionsService,
  ) {}

  @Get()
  list() {
    return this.subscriptionsService.list();
  }

  @Get(':id')
  getById(@Param('id') id: string) {
    return this.subscriptionsService.getById(id);
  }

  @Post()
  create(
    @Body()
    dto: {
      userId: string;
      parkingLotId: string;
      vehicleId?: string | null;
      planName: string;
      amount: number;
      startDate: string;
      endDate: string;
      autoRenew?: boolean;
    },
  ) {
    return this.subscriptionsService.create(dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: any) {
    return this.subscriptionsService.update(id, dto);
  }

  @Patch(':id/cancel')
  cancel(@Param('id') id: string) {
    return this.subscriptionsService.cancel(id);
  }
}