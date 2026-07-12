import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { createHash } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class EdgeApiKeyGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();

    const apiKey = req.headers['x-edge-api-key'] || req.headers['x-api-key'];

    if (!apiKey || typeof apiKey !== 'string') {
      throw new UnauthorizedException('Missing edge API key');
    }

    const keyHash = this.hashApiKey(apiKey);

    const edgeKey = await this.prisma.edgeNodeKey.findFirst({
      where: {
        keyHash,
        isActive: true,
        revokedAt: null,
      },
      include: {
        edgeNode: true,
      },
    });

    if (!edgeKey || !edgeKey.edgeNode) {
      throw new UnauthorizedException('Invalid edge API key');
    }

    if (edgeKey.expiresAt && edgeKey.expiresAt < new Date()) {
      throw new UnauthorizedException('Expired edge API key');
    }

    await this.prisma.edgeNode.update({
      where: {
        id: edgeKey.edgeNode.id,
      },
      data: {
        lastSeenAt: new Date(),
        lastConnectedAt: new Date(),
      },
    });

    req.edge = {
      edgeNodeId: edgeKey.edgeNode.id,
      edgeCode: edgeKey.edgeNode.code,
      edgeName: edgeKey.edgeNode.name,
      tenantId: edgeKey.edgeNode.tenantId ?? null,
      apiKeyId: edgeKey.id,
      keyId: edgeKey.keyId,
    };

    return true;
  }

  private hashApiKey(apiKey: string): string {
    return createHash('sha256').update(apiKey).digest('hex');
  }
}