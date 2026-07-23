import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { hash, compare } from 'bcrypt';
import { PasswordService } from '../auth/password.service';
import { createHmac, randomInt } from 'node:crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { VisitorLoginDto } from './dto/visitor-login.dto';
import { VisitorRegisterDto } from './dto/visitor-register.dto';
import { MemberSignupDto } from './dto/member-signup.dto';
import { MemberLoginDto } from './dto/member-login.dto';
import {
  ConfirmMemberPasswordResetDto,
  RequestMemberPasswordResetDto,
} from './dto/member-password-reset.dto';

@Injectable()
export class MobileAuthService {
  private readonly logger = new Logger(MobileAuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly passwordService: PasswordService,
  ) {}

  async registerMember(dto: MemberSignupDto) {
    const phone = this.normalizePhone(dto.phone);
    const plateNumber = this.normalizePlateNumber(dto.vehiclePlateNumber);

    if (!dto.agreeTerms) {
      throw new BadRequestException('Terms agreement is required');
    }

    if (!dto.phoneVerified || dto.phoneVerificationCode !== '123456') {
      throw new BadRequestException('Phone verification is required');
    }

    const phoneVariants = this.phoneVariants(phone);
    const existingUser = await this.prisma.user.findFirst({
      where: {
        OR: [
          { phone: { in: phoneVariants } },
          { memberProfile: { phone: { in: phoneVariants } } },
        ],
      },
    });

    if (existingUser) {
      throw new BadRequestException('Phone number is already registered');
    }

    const existingVehicle = await this.prisma.vehicle.findUnique({
      where: { plateNumber },
      include: { userLinks: true },
    });

    if (existingVehicle?.userLinks.length) {
      throw new BadRequestException(
        'This plate number is already registered by another member',
      );
    }

    const passwordHash =
      await this.passwordService.hashPassword(dto.password);

    const result = await this.prisma.$transaction(async (tx) => {
      const memberRole = await tx.role.findUnique({
        where: { code: 'MEMBER' },
      });

      if (!memberRole) {
        throw new BadRequestException('MEMBER role is not configured');
      }

      const user = await tx.user.create({
        data: {
          email: null,
          phone,
          passwordHash,
          name: dto.name.trim(),
          isApproved: true,
          status: 'ACTIVE',
          roles: {
            create: { roleId: memberRole.id },
          },
          memberProfile: {
            create: {
              phone,
              vehicleNo: plateNumber,
              billingAutoPay: false,
            },
          },
        },
        include: { memberProfile: true },
      });

      await tx.passwordHistory.create({
        data: {
          userId: user.id,
          passwordHash,
        },
      });

      const vehicle = await tx.vehicle.upsert({
        where: { plateNumber },
        update: {
          memberProfileId: user.memberProfile!.id,
          ownerName: user.name,
          sizeClass: dto.sizeClass,
          powertrainType: dto.powertrainType,
          vehicleType: dto.sizeClass === 'COMPACT' ? 'COMPACT' : 'NORMAL',
          isActive: true,
        },
        create: {
          plateNumber,
          memberProfileId: user.memberProfile!.id,
          ownerName: user.name,
          sizeClass: dto.sizeClass,
          powertrainType: dto.powertrainType,
          vehicleType: dto.sizeClass === 'COMPACT' ? 'COMPACT' : 'NORMAL',
          isActive: true,
        },
      });

      await tx.userVehicle.create({
        data: {
          userId: user.id,
          vehicleId: vehicle.id,
          isPrimary: true,
        },
      });

      const lightCar = await this.upsertEligibilityDefinition(
        tx,
        'LIGHT_CAR',
        '경차',
        'VEHICLE',
      );
      const ev = await this.upsertEligibilityDefinition(
        tx,
        'EV',
        '전기차',
        'VEHICLE',
      );

      if (dto.sizeClass === 'COMPACT') {
        await tx.vehicleEligibilityDeclaration.create({
          data: {
            vehicleId: vehicle.id,
            eligibilityDefinitionId: lightCar.id,
            source: 'MEMBER_SIGNUP',
            isDeclared: true,
          },
        });
      }

      if (dto.powertrainType === 'EV') {
        await tx.vehicleEligibilityDeclaration.create({
          data: {
            vehicleId: vehicle.id,
            eligibilityDefinitionId: ev.id,
            source: 'MEMBER_SIGNUP',
            isDeclared: true,
          },
        });
      }

      const memberEligibilityInputs = [
        ['DISABLED', '장애인', dto.disabledEligible === true],
        ['PREGNANT', '임산부', dto.pregnantEligible === true],
        ['VETERAN', '국가유공자', dto.veteranEligible === true],
      ] as const;

      for (const [code, name, declared] of memberEligibilityInputs) {
        const definition = await this.upsertEligibilityDefinition(
          tx,
          code,
          name,
          'MEMBER',
        );

        if (declared) {
          await tx.memberEligibilityDeclaration.create({
            data: {
              memberProfileId: user.memberProfile!.id,
              eligibilityDefinitionId: definition.id,
              source: 'MEMBER_SIGNUP',
              isDeclared: true,
            },
          });
        }
      }

      return {
        id: user.id,
        name: user.name,
        phone,
        plateNumber,
        sizeClass: dto.sizeClass,
        powertrainType: dto.powertrainType,
      };
    });

    const payload = {
      sub: result.id,
      email: null,
      name: result.name,
      role: 'MEMBER',
    };

    return {
      accessToken: await this.jwtService.signAsync(payload),
      user: payload,
      member: result,
    };
  }

  async loginMember(dto: MemberLoginDto) {
    const rawLoginId = String(dto.loginId ?? dto.phone ?? '').trim();

    if (!rawLoginId) {
      throw new BadRequestException('loginId or phone is required');
    }

    const where = rawLoginId.includes('@')
      ? { email: rawLoginId.toLowerCase() }
      : {
          OR: [
            { phone: { in: this.phoneVariants(rawLoginId) } },
            {
              memberProfile: {
                phone: { in: this.phoneVariants(rawLoginId) },
              },
            },
          ],
        };

    const user = await this.prisma.user.findFirst({
      where,
      include: {
        memberProfile: true,
        roles: { include: { role: true } },
      },
    });

    if (!user?.memberProfile) {
      throw new NotFoundException('Member not found');
    }

    const ok = await this.passwordService.verifyPassword(
      dto.password,
      user.passwordHash,
    );

    if (!ok) {
      throw new UnauthorizedException('Invalid login credentials');
    }

    if (user.status !== 'ACTIVE' || !user.isApproved) {
      throw new UnauthorizedException('Member account is not active');
    }

    if (this.passwordService.needsRehash(user.passwordHash)) {
      const upgradedHash =
        await this.passwordService.hashPassword(dto.password);

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

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date(), failedLoginCount: 0 },
    });

    const payload = {
      sub: user.id,
      email: user.email,
      name: user.name,
      role: 'MEMBER',
    };

    return {
      accessToken: await this.jwtService.signAsync(payload),
      user: payload,
    };
  }


  async requestMemberPasswordReset(dto: RequestMemberPasswordResetDto) {
    const phone = this.normalizePhone(dto.phone);
    const genericResponse = {
      ok: true,
      phone,
      message: '회원 정보가 확인되면 비밀번호 재설정 인증번호가 발송됩니다.',
      expiresInSeconds: 600,
      resendAvailableInSeconds: 60,
    };

    const user = await this.prisma.user.findFirst({
      where: {
        OR: [
          { phone: { in: this.phoneVariants(phone) } },
          { memberProfile: { phone: { in: this.phoneVariants(phone) } } },
        ],
      },
      include: { memberProfile: true },
    });

    if (!user?.memberProfile || user.status !== 'ACTIVE' || !user.isApproved) {
      return genericResponse;
    }

    const now = new Date();
    const oneMinuteAgo = new Date(now.getTime() - 60_000);
    const oneHourAgo = new Date(now.getTime() - 60 * 60_000);

    const [recentToken, hourlyRequestCount] = await Promise.all([
      this.prisma.passwordResetToken.findFirst({
        where: {
          userId: user.id,
          email: phone,
          createdAt: { gt: oneMinuteAgo },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.passwordResetToken.count({
        where: {
          userId: user.id,
          email: phone,
          createdAt: { gt: oneHourAgo },
        },
      }),
    ]);

    if (recentToken) {
      throw new HttpException(
        '인증번호는 1분 후 다시 요청할 수 있습니다.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    if (hourlyRequestCount >= 5) {
      throw new HttpException(
        '인증번호 요청 횟수를 초과했습니다. 잠시 후 다시 시도하세요.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const verificationCode = this.createMemberResetCode();
    const tokenHash = this.hashMemberResetCode(
      user.id,
      phone,
      verificationCode,
    );
    const expiresAt = new Date(now.getTime() + 10 * 60_000);

    const resetToken = await this.prisma.$transaction(async (tx) => {
      await tx.passwordResetToken.updateMany({
        where: {
          userId: user.id,
          email: phone,
          usedAt: null,
        },
        data: { usedAt: now },
      });

      return tx.passwordResetToken.create({
        data: {
          userId: user.id,
          // Mobile members may not have an email address. For this mobile-only
          // reset flow, the existing identifier column stores normalized phone.
          email: phone,
          tokenHash,
          expiresAt,
        },
      });
    });

    try {
      await this.deliverMemberResetCode(phone, verificationCode);
    } catch (error) {
      await this.prisma.passwordResetToken.updateMany({
        where: { id: resetToken.id, usedAt: null },
        data: { usedAt: new Date() },
      });
      throw error;
    }

    return {
      ...genericResponse,
      ...(this.shouldExposeMemberResetCode()
        ? { verificationCodeForDev: verificationCode }
        : {}),
    };
  }

  async confirmMemberPasswordReset(dto: ConfirmMemberPasswordResetDto) {
    const phone = this.normalizePhone(dto.phone);
    const code = String(dto.verificationCode ?? '').trim();
    const newPassword = String(dto.newPassword ?? '');
    const confirmPassword = String(dto.confirmPassword ?? '');

    if (newPassword !== confirmPassword) {
      throw new BadRequestException('새 비밀번호 확인이 일치하지 않습니다.');
    }

    if (
      newPassword.length < 8 ||
      newPassword.length > 64 ||
      !/[A-Za-z]/.test(newPassword) ||
      !/\d/.test(newPassword)
    ) {
      throw new BadRequestException(
        '새 비밀번호는 영문과 숫자를 포함한 8~64자로 입력하세요.',
      );
    }

    const user = await this.prisma.user.findFirst({
      where: {
        OR: [
          { phone: { in: this.phoneVariants(phone) } },
          { memberProfile: { phone: { in: this.phoneVariants(phone) } } },
        ],
      },
      include: { memberProfile: true },
    });

    if (!user?.memberProfile) {
      throw new BadRequestException('인증번호 또는 회원 정보를 확인하세요.');
    }

    const tokenHash = this.hashMemberResetCode(user.id, phone, code);
    const resetToken = await this.prisma.passwordResetToken.findFirst({
      where: {
        userId: user.id,
        email: phone,
        tokenHash,
        usedAt: null,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!resetToken) {
      throw new BadRequestException('인증번호가 잘못되었거나 만료되었습니다.');
    }

    const histories = await this.prisma.passwordHistory.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: { passwordHash: true },
    });

    const previousHashes = [
      user.passwordHash,
      ...histories.map((item) => item.passwordHash),
    ];

    for (const previousHash of previousHashes) {
      if (
        await this.passwordService.verifyPassword(
          newPassword,
          previousHash,
        )
      ) {
        throw new BadRequestException(
          '최근 사용한 비밀번호와 다른 비밀번호를 입력하세요.',
        );
      }
    }

    const passwordHash =
      await this.passwordService.hashPassword(newPassword);
    const usedAt = new Date();

    await this.prisma.$transaction(async (tx) => {
      const consumed = await tx.passwordResetToken.updateMany({
        where: {
          id: resetToken.id,
          usedAt: null,
          expiresAt: { gt: usedAt },
        },
        data: { usedAt },
      });

      if (consumed.count !== 1) {
        throw new BadRequestException('인증번호가 이미 사용되었거나 만료되었습니다.');
      }

      await tx.user.update({
        where: { id: user.id },
        data: {
          passwordHash,
          failedLoginCount: 0,
          lockedUntil: null,
          refreshToken: null,
        },
      });

      await tx.passwordHistory.create({
        data: { userId: user.id, passwordHash },
      });

      await tx.session.deleteMany({ where: { userId: user.id } });

      await tx.passwordResetToken.updateMany({
        where: {
          userId: user.id,
          id: { not: resetToken.id },
          usedAt: null,
        },
        data: { usedAt },
      });
    });

    return {
      ok: true,
      phone,
      message: '비밀번호가 재설정되었습니다. 새 비밀번호로 로그인하세요.',
    };
  }

  private normalizePhone(value: string) {
    const normalized = String(value ?? '').replace(/\D/g, '');

    if (!/^01\d{8,9}$/.test(normalized)) {
      throw new BadRequestException('Invalid mobile phone number');
    }

    return normalized;
  }

  private phoneVariants(value: string) {
    const digits = String(value ?? '').replace(/\D/g, '');
    const variants = new Set<string>([String(value ?? '').trim(), digits]);

    if (digits.length === 11) {
      variants.add(`${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`);
    } else if (digits.length === 10) {
      variants.add(`${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`);
    }

    return [...variants].filter(Boolean);
  }


  private createMemberResetCode() {
    const fixedCode = String(
      process.env.MOBILE_PASSWORD_RESET_DEV_CODE ?? '',
    ).trim();

    if (/^\d{6}$/.test(fixedCode)) {
      return fixedCode;
    }

    return randomInt(0, 1_000_000).toString().padStart(6, '0');
  }

  private hashMemberResetCode(
    userId: string,
    phone: string,
    verificationCode: string,
  ) {
    const secret =
      process.env.MOBILE_PASSWORD_RESET_SECRET ??
      process.env.JWT_SECRET ??
      'dev-member-password-reset-secret';

    return createHmac('sha256', secret)
      .update(`${userId}:${phone}:${verificationCode}`)
      .digest('hex');
  }

  private shouldExposeMemberResetCode() {
    return (
      process.env.NODE_ENV !== 'production' ||
      process.env.MOBILE_PASSWORD_RESET_EXPOSE_CODE === 'true'
    );
  }

  private async deliverMemberResetCode(phone: string, code: string) {
    const webhookUrl = String(
      process.env.MOBILE_PASSWORD_RESET_SMS_WEBHOOK_URL ?? '',
    ).trim();

    if (!webhookUrl) {
      if (!this.shouldExposeMemberResetCode()) {
        throw new ServiceUnavailableException(
          '회원 비밀번호 재설정 SMS 발송 설정이 필요합니다.',
        );
      }

      this.logger.warn(
        `[DEV] member password reset code for ${phone.slice(-4)}: ${code}`,
      );
      return;
    }

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(process.env.MOBILE_PASSWORD_RESET_SMS_WEBHOOK_TOKEN
          ? {
              authorization: `Bearer ${process.env.MOBILE_PASSWORD_RESET_SMS_WEBHOOK_TOKEN}`,
            }
          : {}),
      },
      body: JSON.stringify({
        phone,
        code,
        template: 'MEMBER_PASSWORD_RESET',
        expiresInMinutes: 10,
      }),
    });

    if (!response.ok) {
      throw new ServiceUnavailableException(
        '비밀번호 재설정 인증번호 발송에 실패했습니다.',
      );
    }
  }

  private normalizePlateNumber(value: string) {
    const normalized = String(value ?? '')
      .trim()
      .replace(/\s+/g, '')
      .toUpperCase();

    if (!normalized) {
      throw new BadRequestException('vehiclePlateNumber is required');
    }

    return normalized;
  }

  /**
   * Current policy:
   * Eligibility is based only on information declared by the member.
   * No government or public-network verification is performed.
   *
   * TODO:
   * Add optional external verification when an approved integration and
   * customer requirement become available.
   */
  private upsertEligibilityDefinition(
    tx: any,
    code: string,
    name: string,
    scope: 'MEMBER' | 'VEHICLE',
  ) {
    return tx.discountEligibilityDefinition.upsert({
      where: { code },
      update: { name, scope, isActive: true },
      create: { code, name, scope, isActive: true },
    });
  }


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
        passwordHash:
          await this.passwordService.hashPassword(
            `visitor:${dto.phone}:${Date.now()}`,
          ),
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