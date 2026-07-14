import {
  Injectable,
  Logger,
  OnModuleInit,
} from '@nestjs/common';
import { createHash } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class EdgeLocalKeyBootstrapService implements OnModuleInit {
  private readonly logger = new Logger(EdgeLocalKeyBootstrapService.name);

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit() {
    if (!this.shouldRun()) {
      this.logger.log('Edge local key bootstrap skipped');
      return;
    }

    const edgeNodeId = process.env.EDGE_NODE_ID?.trim();
    const apiKey = (
      process.env.EDGE_API_KEY ??
      process.env.DEV_EDGE_API_KEY ??
      process.env.SYNC_EDGE_API_KEY ??
      ''
    ).trim();

    if (!edgeNodeId) {
      this.logger.warn('EDGE_NODE_ID is required for Edge local key bootstrap');
      return;
    }

    if (!apiKey) {
      this.logger.warn('EDGE_API_KEY or DEV_EDGE_API_KEY is required for Edge local key bootstrap');
      return;
    }

    const keyHash = createHash('sha256').update(apiKey).digest('hex');
    const keyLast4 = apiKey.slice(-4);

    const code = (
      process.env.EDGE_NODE_CODE ??
      process.env.EDGE_CODE ??
      'LOCAL-EDGE'
    ).trim();

    const name = (
      process.env.EDGE_NODE_NAME ??
      process.env.EDGE_NAME ??
      'Local Edge Node'
    ).trim();

    await this.prisma.$transaction(async (tx) => {
      await tx.edgeNode.upsert({
        where: {
          id: edgeNodeId,
        },
        create: {
          id: edgeNodeId,
          code,
          name,
          status: 'ACTIVE',
        },
        update: {
          status: 'ACTIVE',
          updatedAt: new Date(),
        },
      });

      const existingKey = await tx.edgeNodeKey.findFirst({
        where: {
          edgeNodeId,
          keyHash,
        },
      });

      if (existingKey) {
        await tx.edgeNodeKey.updateMany({
          where: {
            edgeNodeId,
            isActive: true,
            revokedAt: null,
            NOT: {
              id: existingKey.id,
            },
          },
          data: {
            isActive: false,
            revokedAt: new Date(),
            updatedAt: new Date(),
          },
        });

        await tx.edgeNodeKey.update({
          where: {
            id: existingKey.id,
          },
          data: {
            isActive: true,
            revokedAt: null,
            updatedAt: new Date(),
          },
        });

        return;
      }

      await tx.edgeNodeKey.updateMany({
        where: {
          edgeNodeId,
          isActive: true,
          revokedAt: null,
        },
        data: {
          isActive: false,
          revokedAt: new Date(),
          updatedAt: new Date(),
        },
      });

      await tx.edgeNodeKey.create({
        data: {
          edgeNodeId,
          keyId: `local-${edgeNodeId}-${Date.now()}`,
          keyHash,
          isActive: true,
        },
      });
    });

    this.logger.log(
      `Edge local key bootstrap completed. edgeNodeId=${edgeNodeId}, keyLast4=${keyLast4}`,
    );
  }

  private shouldRun() {
    const appMode = (
      process.env.APP_PROFILE ??
      process.env.APP_MODE ??
      'cloud'
    ).toLowerCase();

    return appMode === 'edge';
  }
}
