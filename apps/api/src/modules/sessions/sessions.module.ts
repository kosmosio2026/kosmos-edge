import { Module } from '@nestjs/common';
import { BillingModule } from '../billing/billing.module';
import { PrismaModule } from '../../prisma/prisma.module';
import { InvoicesModule } from '../invoices/invoices.module';
import { RedisPublisher } from '../../common/redis/redis.publisher';
import { SessionsController } from './sessions.controller';
import { SessionsService } from './sessions.service';
import { SessionEngineService } from './session-engine.service';
import { RealtimeModule } from '../realtime/realtime.module';
import { RbacModule } from '../rbac/rbac.module';
import { FeeEngineService } from '../billing/fee-engine.service';

@Module({
  imports: [BillingModule, PrismaModule, InvoicesModule, RealtimeModule, RbacModule],
  controllers: [SessionsController],
  providers: [
    SessionsService,
    SessionEngineService,
    FeeEngineService,
    RedisPublisher,
  ],
  exports: [SessionsService, SessionEngineService],
})
export class SessionsModule {}