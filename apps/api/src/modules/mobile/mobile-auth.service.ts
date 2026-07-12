import { BadRequestException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { hash, compare } from 'bcrypt';
import { PrismaService } from '../../prisma/prisma.service';
import { VisitorLoginDto } from './dto/visitor-login.dto';
import { VisitorRegisterDto } from './dto/visitor-register.dto';

@Injectable()
export class MobileAuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async registerVisitor(dto: VisitorRegisterDto) {
    const pin = String(dto.pin ?? dto.pinCode ?? '').trim();
    const pinCodeHash = await hash(pin, 10);

    const existingVisitor = await this.prisma.user.findFirst({
      where: {
        visitorProfile: {
          phone: dto.phone,
        },
      },
      include: {
        visitorProfile: true,
      },
    });

    if (existingVisitor?.visitorProfile) {
      const updated = await this.prisma.visitorProfile.update({
        where: { userId: existingVisitor.id },
        data: {
          pinCodeHash,
          vehicleNo: dto.plateNumber ?? existingVisitor.visitorProfile.vehicleNo,
          phoneVerified: true,
          lastAuthenticatedAt: new Date(),
          agreedAt: existingVisitor.visitorProfile.agreedAt ?? new Date(),
        },
      });

      const payload = {
        sub: existingVisitor.id,
        email: existingVisitor.email,
        name: existingVisitor.name,
      };

      return {
        accessToken: await this.jwtService.signAsync(payload),
        user: payload,
        visitorProfile: updated,
      };
    }

    const user = await this.prisma.user.create({
      data: {
        email: null,
        passwordHash: await hash(`visitor:${dto.phone}:${Date.now()}`, 10),
        name: `Visitor-${dto.phone.slice(-4)}`,
        isApproved: true,
        status: 'ACTIVE',
        visitorProfile: {
          create: {
            phone: dto.phone,
            phoneVerified: true,
            vehicleNo: dto.plateNumber,
            pinCodeHash,
            agreedAt: new Date(),
            lastAuthenticatedAt: new Date(),
          },
        },
      },
      include: {
        visitorProfile: true,
      },
    });

    const payload = {
      sub: user.id,
      email: user.email,
      name: user.name,
    };

    return {
      accessToken: await this.jwtService.signAsync(payload),
      user: payload,
      visitorProfile: user.visitorProfile,
    };
  }

  async loginVisitor(dto: VisitorLoginDto) {
    const user = await this.prisma.user.findFirst({
      where: {
        visitorProfile: {
          phone: dto.phone,
        },
      },
      include: {
        visitorProfile: true,
      },
    });

    if (!user?.visitorProfile?.pinCodeHash) {
      throw new NotFoundException('Visitor not found');
    }

    const ok = await compare(String(dto.pin ?? dto.pinCode ?? '').trim(), user.visitorProfile.pinCodeHash);

    if (!ok) {
      throw new UnauthorizedException('Invalid PIN');
    }

    await this.prisma.visitorProfile.update({
      where: { userId: user.id },
      data: {
        lastAuthenticatedAt: new Date(),
      },
    });

    const payload = {
      sub: user.id,
      email: user.email,
      name: user.name,
    };

    return {
      accessToken: await this.jwtService.signAsync(payload),
      user: payload,
    };
  }

  async getVisitorHistory(phone: string, pin: string) {
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

    if (!user?.visitorProfile?.pinCodeHash) {
      throw new NotFoundException('Visitor not found');
    }

    const ok = await compare(pin, user.visitorProfile.pinCodeHash);

    if (!ok) {
      throw new UnauthorizedException('Invalid PIN');
    }

    return this.prisma.parkingSession.findMany({
      where: {
        userId: user.id,
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 100,
      include: {
        vehicle: true,
        ParkingSpace: {
          include: {
            section: {
              include: {
                parkingLot: true,
              },
            },
          },
        },
        invoice: {
          include: {
            payments: true,
          },
        },
      },
    });
  }

  async resetVisitorPin(phone: string, pin: string) {
    const normalizedPhone = String(phone ?? '').trim();
    const normalizedPin = String(pin ?? '').trim();

    if (!normalizedPhone) {
      throw new BadRequestException('phone is required');
    }

    if (!/^\d{4,6}$/.test(normalizedPin)) {
      throw new BadRequestException('PIN must be 4 to 6 digits');
    }

    const user = await this.prisma.user.findFirst({
      where: {
        OR: [
          { phone: normalizedPhone },
          { visitorProfile: { phone: normalizedPhone } },
        ],
      },
      include: {
        visitorProfile: true,
      },
    });

    if (!user?.visitorProfile) {
      throw new NotFoundException('Visitor profile not found');
    }

    const pinCodeHash = await hash(normalizedPin, 10);

    await this.prisma.visitorProfile.update({
      where: {
        userId: user.id,
      },
      data: {
        pinCodeHash,
        phoneVerified: true,
        lastAuthenticatedAt: new Date(),
      },
    });

    return {
      ok: true,
      phone: normalizedPhone,
      message: 'Visitor PIN has been reset.',
    };
  }

}