import { Injectable, UnauthorizedException } from '@nestjs/common';
import { randomBytes, createHash } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';

export type CreateSessionInput = {
  userId: string;
  deviceId?: string;
  userAgent?: string;
  ip?: string;
};

@Injectable()
export class SessionService {
  constructor(
    private readonly prisma: PrismaService,
  ) {}

  createRefreshToken(): string {
    return randomBytes(48).toString('base64url');
  }

  hashRefreshToken(refreshToken: string): string {
    return createHash('sha256').update(refreshToken).digest('hex');
  }

  async createSession(input: CreateSessionInput) {
    const refreshToken = this.createRefreshToken();
    const refreshTokenHash = this.hashRefreshToken(refreshToken);

    const session = await this.prisma.session.create({
      data: {
        userId: input.userId,
        deviceId: input.deviceId || this.createDeviceId(input),
        userAgent: input.userAgent,
        ip: input.ip,
        refreshTokenHash,
      },
    });

    return {
      session,
      refreshToken,
    };
  }

  async rotateRefreshToken(refreshToken: string) {
    const refreshTokenHash = this.hashRefreshToken(refreshToken);

    const session = await this.prisma.session.findFirst({
      where: {
        refreshTokenHash,
      },
      include: {
        user: {
          include: {
            roles: {
              include: {
                role: true,
              },
            },
            scopes: true,
          },
        },
      },
    });

    if (!session || !session.refreshTokenHash) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    if (!session.user || session.user.status !== 'ACTIVE' || !session.user.isApproved) {
      throw new UnauthorizedException('User is not active');
    }

    const nextRefreshToken = this.createRefreshToken();
    const nextRefreshTokenHash = this.hashRefreshToken(nextRefreshToken);

    const updatedSession = await this.prisma.session.update({
      where: {
        id: session.id,
      },
      data: {
        refreshTokenHash: nextRefreshTokenHash,
        lastUsedAt: new Date(),
      },
    });

    return {
      session: updatedSession,
      user: session.user,
      refreshToken: nextRefreshToken,
    };
  }

  async revokeRefreshToken(refreshToken: string) {
    const refreshTokenHash = this.hashRefreshToken(refreshToken);

    await this.prisma.session.updateMany({
      where: {
        refreshTokenHash,
      },
      data: {
        refreshTokenHash: null,
      },
    });

    return {
      ok: true,
    };
  }

  async revokeUserSessions(userId: string) {
    await this.prisma.session.updateMany({
      where: {
        userId,
      },
      data: {
        refreshTokenHash: null,
      },
    });

    return {
      ok: true,
    };
  }

  private createDeviceId(input: CreateSessionInput): string {
    const source = [
      input.userId,
      input.ip ?? '',
      input.userAgent ?? '',
    ].join('|');

    return createHash('sha256').update(source).digest('hex').slice(0, 32);
  }
}