import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { FeePolicyService } from './fee-policy.service';

@Module({
  imports: [PrismaModule],
  providers: [FeePolicyService],
  exports: [FeePolicyService],
})
export class FeesModule {}