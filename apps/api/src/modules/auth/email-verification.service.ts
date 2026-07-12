import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { createRawToken, hashToken } from '../../common/utils/token-hash';
import { MailService } from './mail.service';

@Injectable()
export class EmailVerificationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mailService: MailService,
  ) {}

  async createAndSend(userId: string, email: string): Promise<void> {
    const rawToken = createRawToken();
    const tokenHash = hashToken(rawToken);

    const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24);

    await this.prisma.emailVerificationToken.create({
      data: {
        userId,
        email,
        tokenHash,
        expiresAt,
      },
    });

    const baseUrl = process.env.WEB_BASE_URL || 'http://localhost:3000';

    const verifyUrl = `${baseUrl}/verify-email?token=${encodeURIComponent(
      rawToken,
    )}`;

    await this.mailService.sendEmail({
      to: email,
      subject: '[KOSMOS Parking] 이메일 인증',
      text: `아래 링크로 이메일을 인증하세요: ${verifyUrl}`,
      html: `
        <p>KOSMOS Parking 이메일 인증</p>
        <p>아래 링크를 클릭하여 이메일을 인증하세요.</p>
        <p><a href="${verifyUrl}">${verifyUrl}</a></p>
      `,
    });
  }

  async verify(rawToken: string): Promise<{ userId: string; status: string }> {
    const tokenHash = hashToken(rawToken);

    const token = await this.prisma.emailVerificationToken.findFirst({
      where: {
        tokenHash,
        usedAt: null,
        expiresAt: {
          gt: new Date(),
        },
      },
      include: {
        user: true,
      },
    });

    if (!token) {
      throw new BadRequestException('Invalid or expired verification token');
    }

    const nextStatus = token.user.isApproved ? 'ACTIVE' : 'PENDING_APPROVAL';

    await this.prisma.$transaction([
      this.prisma.emailVerificationToken.update({
        where: { id: token.id },
        data: { usedAt: new Date() },
      }),
      this.prisma.user.update({
        where: { id: token.userId },
        data: {
          emailVerifiedAt: new Date(),
          status: nextStatus,
        },
      }),
    ]);

    return {
      userId: token.userId,
      status: nextStatus,
    };
  }
}