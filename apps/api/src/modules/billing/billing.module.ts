import { BillingSummaryService } from './billing-summary.service';
import { Module } from '@nestjs/common';
import { RbacModule } from '../rbac/rbac.module';
import { PrismaService } from '../../prisma/prisma.service';

import { BillingController } from './billing.controller';
import { BillingService } from './billing.service';
import { FeePoliciesController } from './fee-policies.controller';
import { FeePoliciesService } from './fee-policies.service';
import { FeeEngineService } from './fee-engine.service';
import { ParkingFeeCalculatorService } from './parking-fee-calculator.service';
import { AutomaticDiscountService } from './automatic-discount.service';
import { ParkingDiscountProgramsService } from './parking-discount-programs.service';
import { TenantsModule } from '../tenants/tenants.module';
import { FacilitiesModule } from '../facilities/facilities.module';

@Module({
  imports: [RbacModule, TenantsModule, FacilitiesModule],
  controllers: [BillingController, FeePoliciesController],
  providers: [
    BillingSummaryService,
    PrismaService,
    BillingService,
    FeePoliciesService,
    FeeEngineService,
    ParkingFeeCalculatorService,
    AutomaticDiscountService,
    ParkingDiscountProgramsService,
  ],
  exports: [
    BillingService,
    FeePoliciesService,
    FeeEngineService,
    ParkingFeeCalculatorService,
    AutomaticDiscountService,
    ParkingDiscountProgramsService,
  ],
})
export class BillingModule {}
