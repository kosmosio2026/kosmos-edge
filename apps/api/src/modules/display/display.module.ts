import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { RbacService } from '../rbac/rbac.service';
import { DisplayController } from './display.controller';
import { DisplayService } from './display.service';

@Module({
  imports: [PrismaModule],
  controllers: [DisplayController],
  providers: [DisplayService, RbacService],
  exports: [DisplayService],
})
export class DisplayModule {}
