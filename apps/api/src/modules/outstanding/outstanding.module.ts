import { Module } from '@nestjs/common';
import { OutstandingController } from './outstanding.controller';
import { OutstandingService } from './outstanding.service';
import { RbacModule } from '../rbac/rbac.module';

@Module({
  imports: [RbacModule],
  controllers: [OutstandingController],
  providers: [OutstandingService],
  exports: [OutstandingService],
})
export class OutstandingModule {}