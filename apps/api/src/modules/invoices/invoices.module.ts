import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { FeesModule } from '../fees/fees.module';
import { BillingModule } from '../billing/billing.module';
import { InvoicesController } from './invoices.controller';
import { InvoicesService } from './invoices.service';
import { TenantsModule } from '../tenants/tenants.module';

@Module({
  imports: [PrismaModule, FeesModule, BillingModule, TenantsModule],
  controllers: [InvoicesController],
  providers: [InvoicesService],
  exports: [InvoicesService],
})
export class InvoicesModule {}