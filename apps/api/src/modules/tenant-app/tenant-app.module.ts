import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { TenantAppController } from './tenant-app.controller';
import { TenantAppService } from './tenant-app.service';
import { TenantsModule } from '../tenants/tenants.module';

@Module({
  imports: [
    TenantsModule,
    JwtModule.register({
      secret:
        process.env.TENANT_APP_JWT_SECRET ||
        process.env.JWT_SECRET ||
        'tenant-app-dev-secret',
      signOptions: {
        expiresIn: process.env.TENANT_APP_JWT_EXPIRES_IN || '30d',
      },
    }),
  ],
  controllers: [TenantAppController],
  providers: [TenantAppService],
})
export class TenantAppModule {}
