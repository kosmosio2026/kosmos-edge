import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../prisma/prisma.service';
import { RegisterDto } from './dto/register.dto';
import { PasswordService } from './password.service';
import { EmailVerificationService } from './email-verification.service';
import { SessionService } from './session.service';

type RegisterRole =
  | 'ADMIN'
  | 'MANAGER'
  | 'OPERATOR'
  | 'MEMBER'
  | 'VISITOR';

type LoginMeta = {
  ip?: string;
  userAgent?: string;
  deviceId?: string;
};

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly passwordService: PasswordService,
    private readonly emailVerificationService: EmailVerificationService,
    private readonly sessionService: SessionService,
  ) {}

  async register(dto: RegisterDto) {
    const exists = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (exists) {
      throw new BadRequestException('Email already exists');
    }

    const roleCode = this.normalizeRole(dto.role);

    if (roleCode === 'ADMIN') {
      this.validateAdminSetupCode(dto.setupCode);
    }

    const role = await this.prisma.role.findUnique({
      where: { code: roleCode },
    });

    if (!role) {
      throw new BadRequestException(`Role not found: ${roleCode}`);
    }

    const passwordHash = await this.passwordService.hashPassword(dto.password);
    const isAutoApproved = this.isAutoApprovedRole(roleCode);

    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        name: dto.name,
        phone: dto.phone,
        passwordHash,
        birthDate: this.parseBirthDate(dto.birthDate),

        /*
         Email verification first.
         If the role is auto-approved, email verification will activate the user.
         If the role needs approval, email verification will move the user to PENDING_APPROVAL.
        */
        isApproved: isAutoApproved,
        status: 'PENDING_EMAIL_VERIFICATION',

        /*
         Only auto-approved users get role immediately.
         MANAGER / OPERATOR role is granted after approval.
        */
        roles: isAutoApproved
          ? {
              create: {
                roleId: role.id,
              },
            }
          : undefined,
      },
      include: {
        roles: {
          include: {
            role: true,
          },
        },
        scopes: true,
      },
    });

    await this.prisma.passwordHistory.create({
      data: {
        userId: user.id,
        passwordHash,
      },
    });

    await this.createRoleProfile(user.id, roleCode, dto);

    if (user.email) {
      await this.emailVerificationService.createAndSend(user.id, user.email);
    }

    return {
      ok: true,
      userId: user.id,
      status: user.status,
      isApproved: user.isApproved,
      message: 'Verification email sent',
    };
  }

  async login(
    email: string,
    password: string,
    meta: LoginMeta = {},
  ) {
    const user = await this.prisma.user.findUnique({
      where: { email },
      include: {
        roles: {
          include: {
            role: true,
          },
        },
        scopes: true,
      },
    });

    if (!user) {
      await this.recordLoginAttempt(
        null,
        email,
        false,
        'USER_NOT_FOUND',
        meta,
      );

      throw new UnauthorizedException('Invalid email or password');
    }

    const ok = await this.passwordService.verifyPassword(
      password,
      user.passwordHash,
    );

    if (!ok) {
      await this.recordLoginAttempt(
        user.id,
        email,
        false,
        'INVALID_PASSWORD',
        meta,
      );

      await this.prisma.user.update({
        where: { id: user.id },
        data: {
          failedLoginCount: {
            increment: 1,
          },
        },
      });

      throw new UnauthorizedException('Invalid email or password');
    }

    /*
     Existing users from previous implementation may have ACTIVE without emailVerifiedAt.
     New users will be blocked until verify-email changes the status.
    */
    if (user.status !== 'ACTIVE') {
      await this.recordLoginAttempt(
        user.id,
        email,
        false,
        `STATUS_${user.status}`,
        meta,
      );

      throw new UnauthorizedException(`User is not active: ${user.status}`);
    }

    if (!user.isApproved) {
      await this.recordLoginAttempt(
        user.id,
        email,
        false,
        'NOT_APPROVED',
        meta,
      );

      throw new UnauthorizedException('User is not approved');
    }

    if (user.lockedUntil && user.lockedUntil > new Date()) {
      await this.recordLoginAttempt(
        user.id,
        email,
        false,
        'LOCKED',
        meta,
      );

      throw new UnauthorizedException('User is locked');
    }

    /*
     If old bcrypt hash is valid, upgrade to Argon2id silently.
    */
    if (this.passwordService.needsRehash(user.passwordHash)) {
      const upgradedHash = await this.passwordService.hashPassword(password);

      await this.prisma.user.update({
        where: { id: user.id },
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

    await this.recordLoginAttempt(
      user.id,
      email,
      true,
      null,
      meta,
    );

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        lastLoginAt: new Date(),
        failedLoginCount: 0,
      },
    });

    const sessionResult = await this.sessionService.createSession({
  userId: user.id,
  deviceId: meta.deviceId,
  userAgent: meta.userAgent,
  ip: meta.ip,
});

return this.toAuthResponse(user.id, sessionResult.refreshToken);
  }

  async refresh(refreshToken: string) {
  const result = await this.sessionService.rotateRefreshToken(refreshToken);

  return this.toAuthResponse(
    result.user.id,
    result.refreshToken,
  );
}

async logout(refreshToken: string) {
  return this.sessionService.revokeRefreshToken(refreshToken);
}

  async updateMyProfile(
    userId: string,
    dto: {
      phone?: string | null;
      emergencyContact?: string | null;
      currentPassword: string;
    },
  ) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        operatorProfile: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    const ok = await this.passwordService.verifyPassword(
      String(dto.currentPassword ?? ''),
      user.passwordHash,
    );

    if (!ok) {
      throw new UnauthorizedException('Current password is invalid');
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        phone: dto.phone?.trim() || null,
      },
    });

    await this.prisma.operatorProfile.upsert({
      where: { userId },
      create: {
        userId,
        emergencyContact: dto.emergencyContact?.trim() || null,
      },
      update: {
        emergencyContact: dto.emergencyContact?.trim() || null,
      },
    });

    return this.me(userId);
  }

  async me(userId: string) {
  const response = await this.toAuthResponse(userId);
  return response.user;
}

  async verifyEmail(rawToken: string) {
    const result = await this.emailVerificationService.verify(rawToken);
    return {
      ok: true,
      ...result,
    };
  }

  async resendVerification(email: string) {
    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    /*
     Do not reveal whether the email exists.
    */
    if (!user || !user.email) {
      return { ok: true };
    }

    if (user.emailVerifiedAt) {
      return { ok: true };
    }

    await this.emailVerificationService.createAndSend(user.id, user.email);

    return { ok: true };
  }

  async forgotPassword(email: string) {
    /*
     Password reset token implementation can be completed in the next auth batch.
     Keep response opaque for security.
    */
    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      return { ok: true };
    }

    return { ok: true };
  }

  async resetPassword(_token: string, _password: string) {
    /*
     To be completed with PasswordResetToken in the next auth batch.
    */
    return { ok: true };
  }

  private normalizeRole(role?: string): RegisterRole {
    const normalized = (role ?? 'MEMBER').toUpperCase();

    if (
      normalized !== 'ADMIN' &&
      normalized !== 'MANAGER' &&
      normalized !== 'OPERATOR' &&
      normalized !== 'MEMBER' &&
      normalized !== 'VISITOR'
    ) {
      throw new BadRequestException(`Unsupported role: ${role}`);
    }

    return normalized;
  }

  private validateAdminSetupCode(setupCode?: string) {
    const expected = process.env.ADMIN_REGISTER_CODE;

    if (!expected) {
      throw new UnauthorizedException('Admin registration is not configured');
    }

    if (!setupCode || setupCode !== expected) {
      throw new UnauthorizedException('Invalid admin setup code');
    }
  }

  private parseBirthDate(value?: string | Date | null) {
    if (!value) return null;

    const date = value instanceof Date ? value : new Date(value);

    if (Number.isNaN(date.getTime())) {
      throw new BadRequestException('Invalid birthDate');
    }

    return date;
  }

  private isAutoApprovedRole(roleCode: RegisterRole) {
    return (
      roleCode === 'ADMIN' ||
      roleCode === 'MEMBER' ||
      roleCode === 'VISITOR'
    );
  }

  private async createRoleProfile(
    userId: string,
    roleCode: RegisterRole,
    dto: RegisterDto,
  ) {
    if (roleCode === 'MEMBER') {
      await this.createMemberProfileAndVehicle(userId, dto);
      return;
    }

    if (roleCode === 'VISITOR') {
      await this.createVisitorProfile(userId, dto);
      return;
    }

    if (roleCode === 'MANAGER') {
      await this.createManagerProfile(userId, dto);
      return;
    }

    if (roleCode === 'OPERATOR') {
      await this.createOperatorProfile(userId, dto);
    }
  }

  private async createMemberProfileAndVehicle(
    userId: string,
    dto: RegisterDto,
  ) {
    const vehicleNo = dto.vehicleNo ?? dto.plateNumber;

    await this.prisma.memberProfile.upsert({
      where: { userId },
      update: {
        phone: dto.phone,
        vehicleNo,
        emergencyContact: dto.emergencyContact,
        billingAutoPay: dto.billingAutoPay ?? false,
      },
      create: {
        userId,
        phone: dto.phone,
        vehicleNo,
        emergencyContact: dto.emergencyContact,
        billingAutoPay: dto.billingAutoPay ?? false,
      },
    });

    if (!vehicleNo) return;

    const vehicle = await this.prisma.vehicle.upsert({
      where: {
        plateNumber: vehicleNo,
      },
      update: {
        ownerName: dto.name,
        isActive: true,
      },
      create: {
        plateNumber: vehicleNo,
        ownerName: dto.name,
        vehicleType: 'NORMAL',
        isActive: true,
      },
    });

    const existingLink = await this.prisma.userVehicle.findFirst({
      where: {
        userId,
        vehicleId: vehicle.id,
      },
    });

    if (!existingLink) {
      await this.prisma.userVehicle.create({
        data: {
          userId,
          vehicleId: vehicle.id,
        },
      });
    }
  }

  private async createVisitorProfile(userId: string, dto: RegisterDto) {
    await this.prisma.visitorProfile.upsert({
      where: { userId },
      update: {
        phone: dto.phone,
        vehicleNo: dto.vehicleNo ?? dto.plateNumber,
        visitPurpose: dto.visitPurpose,
        hostName: dto.hostName,
        note: dto.note,
        agreedAt: new Date(),
        lastAuthenticatedAt: new Date(),
      },
      create: {
        userId,
        phone: dto.phone,
        vehicleNo: dto.vehicleNo ?? dto.plateNumber,
        visitPurpose: dto.visitPurpose,
        hostName: dto.hostName,
        note: dto.note,
        agreedAt: new Date(),
        lastAuthenticatedAt: new Date(),
      },
    });
  }

  private async createManagerProfile(userId: string, dto: RegisterDto) {
    const managerRegisterMode =
      dto.managerRegisterMode === 'JOIN_TENANT' ? 'JOIN_TENANT' : 'CREATE_TENANT';

    let tenant:
      | {
          id: string;
          name: string;
          code: string;
        }
      | null = null;

    if (managerRegisterMode === 'JOIN_TENANT') {
      if (dto.tenantId) {
        tenant = await this.prisma.tenant.findUnique({
          where: {
            id: dto.tenantId,
          },
          select: {
            id: true,
            name: true,
            code: true,
          },
        });
      }

      if (!tenant && dto.tenantCode) {
        tenant = await this.prisma.tenant.findUnique({
          where: {
            code: dto.tenantCode.trim().toUpperCase(),
          },
          select: {
            id: true,
            name: true,
            code: true,
          },
        });
      }

      if (!tenant) {
        throw new BadRequestException('tenantId or tenantCode is required for tenant manager join');
      }
    } else {
      if (!dto.companyName) {
        throw new BadRequestException('companyName is required for manager');
      }

      const tenantCode = dto.companyName
        .trim()
        .toUpperCase()
        .replace(/\s+/g, '-');

      tenant = await this.prisma.tenant.upsert({
        where: {
          code: tenantCode,
        },
        update: {
          name: dto.companyName,
        },
        create: {
          name: dto.companyName,
          code: tenantCode,
        },
        select: {
          id: true,
          name: true,
          code: true,
        },
      });
    }

    const tenantRole =
      managerRegisterMode === 'JOIN_TENANT' ? 'MANAGER' : 'TENANT_OWNER';

    await this.prisma.user.update({
      where: {
        id: userId,
      },
      data: {
        tenantId: tenant.id,
      },
    });

    await this.prisma.managerProfile.upsert({
      where: { userId },
      update: {
        companyName: tenant.name,
        department: dto.department,
      },
      create: {
        userId,
        companyName: tenant.name,
        department: dto.department,
      },
    });

    await this.prisma.approvalRequest.create({
      data: {
        requesterId: userId,
        tenantId: tenant.id,
        type: 'MANAGER_REGISTRATION',
        status: 'PENDING',
        companyName: tenant.name,
        requestData: {
          managerRegisterMode,
          tenantRole,
          tenantCode: tenant.code,
        },
      },
    });
  }

  private async createOperatorProfile(userId: string, dto: RegisterDto) {
    await this.prisma.operatorProfile.upsert({
      where: { userId },
      update: {
        employeeNo: dto.employeeNo,
        companyName: dto.companyName,
        shiftType: dto.shiftType,
      },
      create: {
        userId,
        employeeNo: dto.employeeNo,
        companyName: dto.companyName,
        shiftType: dto.shiftType,
      },
    });

    await this.prisma.approvalRequest.create({
      data: {
        requesterId: userId,
        type: 'OPERATOR_REGISTRATION',
        status: 'PENDING',
        companyName: dto.companyName,
      },
    });
  }

  private async toAuthResponse(userId: string, refreshToken?: string) {
  const user = await this.prisma.user.findUnique({
    where: { id: userId },
    include: {
      roles: {
        include: {
          role: true,
        },
      },
      scopes: true,
    },
  });

  if (!user) {
    throw new NotFoundException('User not found');
  }

  const roles = user.roles.map((r) => r.role.code);
  const permissions = await this.getUserPermissions(user.id);

  const scopes = {
    parkingLotIds: [
      ...new Set(
        user.scopes
          .map((scope) => scope.parkingLotId)
          .filter((value): value is string => Boolean(value)),
      ),
    ],
    parkingSectionIds: [
      ...new Set(
        user.scopes
          .map((scope) => scope.parkingSectionId)
          .filter((value): value is string => Boolean(value)),
      ),
    ],
    parkingSpaceIds: [
      ...new Set(
        user.scopes
          .map((scope) => scope.parkingSpaceId)
          .filter((value): value is string => Boolean(value)),
      ),
    ],
  };

  const payload = {
    sub: user.id,
    email: user.email,
    name: user.name,
    roles,
    permissions,
    isApproved: user.isApproved,
    scopes,
  };

  const accessToken = await this.jwtService.signAsync(payload);

  const response: any = {
    accessToken,
    tokenType: 'Bearer',
    expiresIn: 15 * 60,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      status: user.status,
      emailVerifiedAt: user.emailVerifiedAt,
      roles,
      permissions,
      isApproved: user.isApproved,
      scopes,
    },
  };

  if (refreshToken) {
    response.refreshToken = refreshToken;
  }

  return response;
}

  private async getUserPermissions(userId: string): Promise<string[]> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        roles: {
          include: {
            role: {
              include: {
                permissions: {
                  include: {
                    permission: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    const permissions = new Set<string>();

    for (const userRole of user?.roles ?? []) {
      for (const rolePermission of userRole.role.permissions ?? []) {
        permissions.add(rolePermission.permission.key);
      }
    }

    return [...permissions];
  }

  private async recordLoginAttempt(
    userId: string | null,
    email: string,
    success: boolean,
    reason: string | null,
    meta: LoginMeta,
  ) {
    await this.prisma.loginAttempt.create({
      data: {
        userId,
        email,
        success,
        reason,
        ip: meta.ip,
        userAgent: meta.userAgent,
      },
    });
  }
}