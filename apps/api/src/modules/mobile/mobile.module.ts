import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';

import { PrismaModule } from '../../prisma/prisma.module';
import { RbacModule } from '../rbac/rbac.module';

import { MobileController } from './mobile.controller';
import { MobileQrController } from './mobile-qr.controller';
import { MobileMapService } from './mobile-map.service';
import { MobileParkingService } from './mobile-parking.service';
import { MobileAuthService } from './mobile-auth.service';
import { MobileQrService } from './mobile-qr.service';
import { VisitorVerificationService } from './visitor-verification.service';
import { MobileVehicleService } from './mobile-vehicle.service';
import { MobileStatusService } from './mobile-status.service';
import { MobileNotificationService } from './mobile-notification.service';
import { MobileHomeService } from './mobile-home.service';
import { MobileMapOptimizedService } from './mobile-map-optimized.service';

@Module({
  imports: [
    PrismaModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET ?? 'dev-secret',
      signOptions: {
        expiresIn: '7d',
      },
    }),
    RbacModule,
  ],
  controllers: [MobileController, MobileQrController],
  providers: [MobileQrService, 
    MobileMapService,
    MobileParkingService,
    MobileAuthService,
    VisitorVerificationService,
    MobileVehicleService,
    MobileStatusService,
    MobileNotificationService,
    MobileHomeService,
    MobileMapOptimizedService,
  ],
})
export class MobileModule {}
