import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { WatcherController } from './watcher.controller';
import { WatcherService } from './watcher.service';

@Module({
  imports: [PrismaModule],
  controllers: [WatcherController],
  providers: [WatcherService],
  exports: [WatcherService],
})
export class WatcherModule {}
