import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PlateRecognitionService } from './plate-recognition.service';

@Controller('plate-recognition')
@UseGuards(JwtAuthGuard)
export class PlateRecognitionController {
  constructor(private readonly service: PlateRecognitionService) {}

  @Post('recognize')
  recognize(
    @Body()
    body: {
      imageUrl?: string;
      imageBase64?: string;
      fileName?: string;
      plateHint?: string;
    },
  ) {
    return this.service.recognizeKoreanPlate(body);
  }
}
