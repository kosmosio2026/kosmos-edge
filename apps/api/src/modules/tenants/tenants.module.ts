import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { TenantsController } from './tenants.controller';
import { TenantsService } from './tenants.service';
import { TenantCouponsService } from './tenant-coupons.service';

@Module({
  imports: [PrismaModule],
  controllers: [TenantsController],
  providers: [TenantsService, TenantCouponsService],
  exports: [TenantCouponsService],
})
export class TenantsModule {}
