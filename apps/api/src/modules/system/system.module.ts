import { Module } from '@nestjs/common';
import { SystemStatusController } from './system-status.controller';
import { SystemStatusService } from './system-status.service';
import { RbacModule } from '../rbac/rbac.module';

@Module({
  imports: [RbacModule],
  controllers: [SystemStatusController],
  providers: [SystemStatusService],
  exports: [SystemStatusService],
})
export class SystemModule {}