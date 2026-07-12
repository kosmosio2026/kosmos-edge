import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, UserStatus } from '@parking/db';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class VisitorVerificationService {
  constructor(private readonly prisma: PrismaService) {}

  async requestPhoneVerification(phone: string) {
    const code = '123456';

    const existing = await this.prisma.user.findFirst({
      where: {
        visitorProfile: {
          phone,
        },
      },
      include: {
        visitorProfile: true,
      },
    });

    if (existing?.visitorProfile) {
      await this.prisma.visitorProfile.update({
        where: { userId: existing.id },
        data: {
          note: `verification_code:${code}`,
        },
      });

      return {
        ok: true,
        phone,
        verificationCodeForDev: code,
      };
    }

    const user = await this.prisma.user.create({
      data: {
        email: null,
        passwordHash: 'visitor-verification-stub',
        name: `Visitor-${phone.slice(-4)}`,
        isApproved: true,
        status: UserStatus.ACTIVE,
        visitorProfile: {
          create: {
            phone,
            note: `verification_code:${code}`,
          },
        },
      },
      include: {
        visitorProfile: true,
      },
    });

    return {
      ok: true,
      userId: user.id,
      phone,
      verificationCodeForDev: code,
    };
  }

  async verifyPhone(phone: string, code: string) {
    const user = await this.prisma.user.findFirst({
      where: {
        visitorProfile: {
          phone,
        },
      },
      include: {
        visitorProfile: true,
      },
    });

    if (!user?.visitorProfile) {
      throw new NotFoundException('Visitor profile not found');
    }

    const note = user.visitorProfile.note ?? '';
    const matched = note.includes(`verification_code:${code}`);

    if (!matched) {
      return {
        ok: false,
        verified: false,
      };
    }

    await this.prisma.visitorProfile.update({
      where: { userId: user.id },
      data: {
        phoneVerified: true,
        lastAuthenticatedAt: new Date(),
        note: 'phone_verified',
      },
    });

    return {
      ok: true,
      verified: true,
      userId: user.id,
    };
  }

  async resetVisitorPin(phone: string, newPinHash: string) {
    const user = await this.prisma.user.findFirst({
      where: {
        visitorProfile: {
          phone,
        },
      },
      include: {
        visitorProfile: true,
      },
    });

    if (!user?.visitorProfile) {
      throw new NotFoundException('Visitor profile not found');
    }

    return this.prisma.visitorProfile.update({
      where: { userId: user.id },
      data: {
        pinCodeHash: newPinHash,
        lastAuthenticatedAt: new Date(),
      },
    });
  }
}