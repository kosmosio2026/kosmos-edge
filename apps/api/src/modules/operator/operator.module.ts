import { Module } from '@nestjs/common';
import { OperatorDashboardController } from './operator-dashboard.controller';
import { OperatorDashboardService } from './operator-dashboard.service';
import { RbacModule } from '../rbac/rbac.module';

@Module({
  imports: [RbacModule],
  controllers: [OperatorDashboardController],
  providers: [OperatorDashboardService],
  exports: [OperatorDashboardService],
})
export class OperatorModule {}