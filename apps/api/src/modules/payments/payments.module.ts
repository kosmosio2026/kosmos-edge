import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { RealtimeModule } from '../realtime/realtime.module';
import { RbacModule } from '../rbac/rbac.module';
import { InvoicesModule } from '../invoices/invoices.module';
import { TenantsModule } from '../tenants/tenants.module';

@Module({
  imports: [
    PrismaModule,
    RealtimeModule,
    RbacModule,
    InvoicesModule,
    TenantsModule,
  ],
  controllers: [PaymentsController],
  providers: [PaymentsService],
  exports: [PaymentsService],
})
export class PaymentsModule {}