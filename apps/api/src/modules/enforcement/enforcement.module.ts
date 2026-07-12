import { Module } from '@nestjs/common';

import { RbacModule } from '../rbac/rbac.module';
import { RealtimeModule } from '../realtime/realtime.module';
import { EnforcementController } from './enforcement.controller';
import { EnforcementService } from './enforcement.service';

@Module({
  imports: [RbacModule, RealtimeModule],
  controllers: [EnforcementController],
  providers: [EnforcementService],
})
export class EnforcementModule {}
