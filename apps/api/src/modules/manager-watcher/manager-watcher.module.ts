import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { AdminWatcherController, ManagerWatcherController } from './manager-watcher.controller';
import { ManagerWatcherService } from './manager-watcher.service';

@Module({
  imports: [PrismaModule],
  controllers: [ManagerWatcherController, AdminWatcherController],
  providers: [ManagerWatcherService],
  exports: [ManagerWatcherService],
})
export class ManagerWatcherModule {}
