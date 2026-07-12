import { Module } from '@nestjs/common';
import { RegistrationReviewController } from './registration-review.controller';
import { RegistrationReviewService } from './registration-review.service';

@Module({
  controllers: [RegistrationReviewController],
  providers: [RegistrationReviewService],
})
export class RegistrationReviewModule {}
