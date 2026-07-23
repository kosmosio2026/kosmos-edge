import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { PasswordService } from '../auth/password.service';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class MobileAuthService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
    private readonly passwordService: PasswordService,
  ) {}

  async memberSignup(body: any) {
    const name = String(body?.name ?? '').trim();
    const phone = String(body?.phone ?? '').trim();
    const vehiclePlateNumber = String(body?.vehiclePlateNumber ?? '').trim();
    const password = String(body?.password ?? '');
    const phoneVerificationCode = String(body?.phoneVerificationCode ?? '').trim();

    if (!name) {
      throw new BadRequestException('name is required');
    }

    if (!phone) {
      throw new BadRequestException('phone is required');
    }

    if (phoneVerificationCode !== '123456' && body?.phoneVerified !== true) {
      throw new BadRequestException('phone verification is required');
    }

    if (!vehiclePlateNumber) {
      throw new BadRequestException('vehiclePlateNumber is required');
    }

    if (password.length < 8) {
      throw new BadRequestException('password must be at least 8 characters');
    }

    const email = `${phone}@mobile.kosmos.local`;

    const existing = await this.prisma.user.findFirst({
      where: {
        OR: [{ email }, { phone }],
      },
    });

    if (existing) {
      throw new BadRequestException('이미 가입된 휴대폰 번호입니다.');
    }

    const passwordHash =
      await this.passwordService.hashPassword(password);

    const memberRole = await this.prisma.role.findUnique({
      where: { code: 'MEMBER' },
    });

    const user = await this.prisma.user.create({
      data: {
        email,
        phone,
        name,
        passwordHash,
        isApproved: true,
        roles: memberRole
          ? {
              create: {
                roleId: memberRole.id,
              },
            }
          : undefined,
        memberProfile: {
          create: {
            phone,
          },
        },
      },
      include: {
        roles: {
          include: {
            role: true,
          },
        },
      },
    });


    const memberProfile = await this.prisma.memberProfile.findUnique({
      where: {
        userId: user.id,
      },
    });

    if (memberProfile) {
      const vehicle = await this.prisma.vehicle.upsert({
        where: {
          plateNumber: vehiclePlateNumber,
        },
        create: {
          plateNumber: vehiclePlateNumber,
          ownerName: name,
          memberProfileId: memberProfile.id,
        },
        update: {
          ownerName: name,
          memberProfileId: memberProfile.id,
          isActive: true,
        },
      });

      await this.prisma.userVehicle.upsert({
        where: {
          userId_vehicleId: {
            userId: user.id,
            vehicleId: vehicle.id,
          },
        },
        create: {
          userId: user.id,
          vehicleId: vehicle.id,
          isPrimary: true,
        },
        update: {
          isPrimary: true,
        },
      });

      await this.prisma.memberProfile.update({
        where: {
          userId: user.id,
        },
        data: {
          vehicleNo: vehiclePlateNumber,
        },
      });
    }

    return {
      id: user.id,
      email: user.email,
      phone: user.phone,
      name: user.name,
      roles: user.roles.map((item: any) => item.role.code),
    };
  }

  async memberLogin(body: any) {
    const loginId = String(body?.loginId ?? body?.email ?? body?.phone ?? '').trim();
    const password = String(body?.password ?? '');

    if (!loginId) {
      throw new BadRequestException('loginId is required');
    }

    if (!password) {
      throw new BadRequestException('password is required');
    }

    const user = await this.prisma.user.findFirst({
      where: {
        OR: [
          { phone: loginId },
          { email: loginId },
          { email: `${loginId}@mobile.kosmos.local` },
        ],
      },
      include: {
        roles: {
          include: {
            role: true,
          },
        },
        memberProfile: true,
      },
    });

    if (!user?.passwordHash) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (!user.memberProfile) {
      throw new UnauthorizedException('Member profile not found');
    }

    const ok = await this.passwordService.verifyPassword(
      password,
      user.passwordHash,
    );

    if (!ok) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (this.passwordService.needsRehash(user.passwordHash)) {
      const upgradedHash =
        await this.passwordService.hashPassword(password);

      await this.prisma.user.update({
        where: {
          id: user.id,
        },
        data: {
          passwordHash: upgradedHash,
        },
      });

      await this.prisma.passwordHistory.create({
        data: {
          userId: user.id,
          passwordHash: upgradedHash,
        },
      });
    }

    const roles = user.roles.map((item: any) => item.role.code);

    const accessToken = await this.jwtService.signAsync({
      sub: user.id,
      email: user.email,
      phone: user.phone,
      roles,
      profileType: 'MEMBER',
    });

    return {
      accessToken,
      user: {
        id: user.id,
        email: user.email,
        phone: user.phone,
        name: user.name,
        roles,
        profileType: 'MEMBER',
      },
    };
  }

  async visitorLogin(body: any) {
    const phone = String(body?.phone ?? '').trim();
    const pinCode = String(body?.pinCode ?? '').trim();

    if (!phone) {
      throw new BadRequestException('phone is required');
    }

    if (!pinCode) {
      throw new BadRequestException('pinCode is required');
    }

    const user = await this.prisma.user.findFirst({
      where: {
        phone,
      },
      include: {
        roles: {
          include: {
            role: true,
          },
        },
        visitorProfile: true,
      },
    });

    if (!user?.visitorProfile?.pinCodeHash) {
      throw new UnauthorizedException('방문객 정보를 찾을 수 없습니다.');
    }

    const ok = await bcrypt.compare(pinCode, user.visitorProfile.pinCodeHash);

    if (!ok) {
      throw new UnauthorizedException('방문객 PIN이 올바르지 않습니다.');
    }

    await this.prisma.visitorProfile.update({
      where: {
        userId: user.id,
      },
      data: {
        lastAuthenticatedAt: new Date(),
      },
    });

    const roles = user.roles.map((item: any) => item.role.code);

    const accessToken = await this.jwtService.signAsync({
      sub: user.id,
      email: user.email,
      phone: user.phone,
      roles,
      profileType: 'VISITOR',
    });

    return {
      accessToken,
      user: {
        id: user.id,
        email: user.email,
        phone: user.phone,
        name: user.name,
        roles,
        profileType: 'VISITOR',
      },
    };
  }

  private getJwtUserId(jwtUser: any) {
    const userId = jwtUser?.sub ?? jwtUser?.userId ?? jwtUser?.id;
    if (!userId) {
      throw new UnauthorizedException('Invalid mobile token');
    }
    return String(userId);
  }

  async memberMe(jwtUser: any) {
    const userId = this.getJwtUserId(jwtUser);

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        roles: {
          include: {
            role: true,
          },
        },
        memberProfile: true,
      },
    });

    if (!user?.memberProfile) {
      throw new UnauthorizedException('Member profile not found');
    }

    return {
      id: user.id,
      email: user.email,
      phone: user.phone,
      name: user.name,
      roles: user.roles.map((item: any) => item.role.code),
      memberProfile: user.memberProfile,
    };
  }

  async memberVehicles(jwtUser: any) {
    const userId = this.getJwtUserId(jwtUser);

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        memberProfile: true,
      },
    });

    if (!user?.memberProfile) {
      throw new UnauthorizedException('Member profile not found');
    }

    const links = await this.prisma.userVehicle.findMany({
      where: {
        userId,
      },
      include: {
        vehicle: true,
      },
      orderBy: {
        createdAt: 'asc',
      },
    });

    const linkedVehicles = links
      .map((link: any) => ({
        id: link.vehicle.id,
        plateNumber: link.vehicle.plateNumber,
        vehicleType: link.vehicle.vehicleType,
        ownerName: link.vehicle.ownerName,
        isPrimary: link.isPrimary,
        isActive: link.vehicle.isActive,
        createdAt: link.vehicle.createdAt,
      }))
      .filter((vehicle: any) => vehicle.isActive !== false);

    const profileVehicleNo = user.memberProfile.vehicleNo
      ? {
          id: null,
          plateNumber: user.memberProfile.vehicleNo,
          vehicleType: null,
          ownerName: user.name,
          isPrimary: linkedVehicles.length === 0,
          isActive: true,
          createdAt: user.memberProfile.createdAt,
        }
      : null;

    const vehicles = linkedVehicles.length > 0
      ? linkedVehicles
      : profileVehicleNo
        ? [profileVehicleNo]
        : [];

    return {
      user: {
        id: user.id,
        email: user.email,
        phone: user.phone,
        name: user.name,
      },
      vehicles,
    };
  }

}
