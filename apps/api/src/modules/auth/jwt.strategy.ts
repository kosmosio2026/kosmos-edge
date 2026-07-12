import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET', 'change-me'),
    });
  }

  async validate(payload: any) {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
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
        scopes: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException();
    }

    if (user.status !== 'ACTIVE') {
      throw new UnauthorizedException(`User is not active: ${user.status}`);
    }

    if (!user.isApproved) {
      throw new UnauthorizedException('User is not approved');
    }

    if (user.lockedUntil && user.lockedUntil > new Date()) {
      throw new UnauthorizedException('User is locked');
    }

    const roles = user.roles.map((r) => r.role.code);

    const permissions = Array.from(
      new Set(
        user.roles.flatMap((userRole) =>
          userRole.role.permissions.map(
            (rolePermission) => rolePermission.permission.key,
          ),
        ),
      ),
    );

    return {
      sub: user.id,
      id: user.id,
      email: user.email ?? null,
      name: user.name ?? null,
      roles,
      permissions,
      isApproved: user.isApproved,
      status: user.status,
      emailVerifiedAt: user.emailVerifiedAt,
      scopes: {
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
      },
      tenantId: (user as any).tenantId ?? null,
    };
  }
}