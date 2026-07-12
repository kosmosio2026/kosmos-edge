import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { RbacModule } from '../rbac/rbac.module';

import { ControlPanelController } from './control-panel.controller';
import { ControlPanelService } from './control-panel.service';

@Module({
  imports: [PrismaModule, RbacModule],
  controllers: [ControlPanelController],
  providers: [ControlPanelService],
})
export class ControlPanelModule {}
