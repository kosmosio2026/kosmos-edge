import { Module } from '@nestjs/common';
import { RbacModule } from '../rbac/rbac.module';
import { PrismaService } from '../../prisma/prisma.service';

import { BillingController } from './billing.controller';
import { BillingService } from './billing.service';
import { FeePoliciesController } from './fee-policies.controller';
import { FeePoliciesService } from './fee-policies.service';
import { FeeEngineService } from './fee-engine.service';

@Module({
  imports: [RbacModule],
  controllers: [BillingController, FeePoliciesController],
  providers: [
    PrismaService,
    BillingService,
    FeePoliciesService,
    FeeEngineService,
  ],
  exports: [BillingService, FeePoliciesService, FeeEngineService],
})
export class BillingModule {}
