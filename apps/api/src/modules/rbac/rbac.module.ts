import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { RbacService } from './rbac.service';
import { RbacController } from './rbac.controller';
import { RoleAdminService } from './role-admin.service';
import { RoleAdminController } from './role-admin.controller';
import { RbacAdminPageService } from './rbac-admin-page.service';
import { RbacAdminPageController } from './rbac-admin-page.controller';
import { ScopeAccessService } from './scope-access.service';

@Module({
  imports: [
    PrismaModule,
    RbacModule,
  ],
  providers: [
    RbacService,
    RoleAdminService,
    RbacAdminPageService,
    ScopeAccessService,
  ],
  controllers: [
    RbacController,
    RoleAdminController,
    RbacAdminPageController,
  ],
  exports: [
    RbacService,
    RoleAdminService,
    RbacAdminPageService,
    ScopeAccessService,
  ],
})
export class RbacModule {}