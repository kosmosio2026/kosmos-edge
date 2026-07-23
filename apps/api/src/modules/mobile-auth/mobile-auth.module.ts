import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PrismaService } from '../../prisma/prisma.service';
import { MobileAuthController } from './mobile-auth.controller';
import { MobileAuthService } from './mobile-auth.service';
import { PasswordService } from '../auth/password.service';

@Module({
  imports: [
    JwtModule.register({
      secret: process.env.JWT_SECRET ?? 'dev-secret',
      signOptions: {
        expiresIn: process.env.JWT_EXPIRES_IN ?? '7d',
      },
    }),
  ],
  controllers: [MobileAuthController],
  providers: [MobileAuthService, PrismaService, PasswordService],
})
export class MobileAuthModule {}
