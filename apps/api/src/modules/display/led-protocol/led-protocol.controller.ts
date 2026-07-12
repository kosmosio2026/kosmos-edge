import { Body, Controller, Post } from '@nestjs/common';
import { LedProtocolService } from './led-protocol.service';
import { CreateAdDto } from '../dto/create-ad.dto';
import { DeleteAdDto } from '../dto/delete-ad.dto';
import { SetPowerDto } from '../dto/set-power.dto';
import { SetBrightnessDto } from '../dto/set-brightness.dto';

@Controller('led')
export class LedProtocolController {
  constructor(private readonly service: LedProtocolService) {}

  @Post('ads')
  insertAd(@Body() dto: CreateAdDto) {
    return this.service.insertAd(dto);
  }

  @Post('ads/delete')
  deleteAd(@Body() dto: DeleteAdDto) {
    return this.service.deleteAd(dto.idx);
  }

  @Post('power')
  setPower(@Body() dto: SetPowerDto) {
    return this.service.setPower(dto.on);
  }

  @Post('brightness')
  setBrightness(@Body() dto: SetBrightnessDto) {
    return this.service.setBrightness(dto.level);
  }
}
