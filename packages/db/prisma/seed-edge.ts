import { PrismaClient } from '../generated/client';
import { randomBytes, createHash } from 'crypto';

const prisma = new PrismaClient();

function createRawApiKey() {
  return `kedge_${randomBytes(32).toString('base64url')}`;
}

function hashApiKey(raw: string) {
  return createHash('sha256').update(raw).digest('hex');
}

async function main() {
  const rawApiKey = createRawApiKey();

  const tenant = await prisma.tenant.upsert({
    where: {
      code: 'DEFAULT',
    },
    update: {
      name: 'Default Tenant',
    },
    create: {
      code: 'DEFAULT',
      name: 'Default Tenant',
    },
  });

  const edgeNode = await prisma.edgeNode.upsert({
  where: {
    code: 'EDGE-MINI-001',
  },
  update: {
    name: 'Kosmos Mini Edge 001',
    status: 'ACTIVE',
    tenant: {
      connect: {
        id: tenant.id,
      },
    },
  },
  create: {
    code: 'EDGE-MINI-001',
    name: 'Kosmos Mini Edge 001',
    status: 'ACTIVE',
    tenant: {
      connect: {
        id: tenant.id,
      },
    },
  },
});

  await prisma.edgeNodeKey.upsert({
  where: {
    keyId: 'dev-key-001',
  },
  update: {
    keyHash: hashApiKey(rawApiKey),
    isActive: true,
    revokedAt: null,
  },
  create: {
    edgeNodeId: edgeNode.id,
    keyId: 'dev-key-001',
    keyHash: hashApiKey(rawApiKey),
    isActive: true,
  },
});

  console.log('');
  console.log('Edge seed completed.');
  console.log('');
  console.log('EDGE_NODE_CODE=EDGE-MINI-001');
  console.log(`EDGE_API_KEY=${rawApiKey}`);
  console.log('');
  console.log('Save this key. It will not be shown again.');
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });