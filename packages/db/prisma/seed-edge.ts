import {
  PrismaClient,
} from '../generated/client';
import {
  createHash,
  randomBytes,
} from 'crypto';

const prisma = new PrismaClient();

function createRawApiKey() {
  return `kedge_${randomBytes(32).toString('base64url')}`;
}

function hashApiKey(raw: string) {
  return createHash('sha256')
    .update(raw)
    .digest('hex');
}

async function main() {
  const edgeNodeCode =
    process.env.EDGE_NODE_ID?.trim() ||
    'EDGE-MINI-001';

  const edgeNodeName =
    process.env.EDGE_NODE_NAME?.trim() ||
    'Kosmos Mini Edge 001';

  const keyId =
    process.env.EDGE_KEY_ID?.trim() ||
    'dev-key-001';

  /*
   * 기존 키는 bootstrap seed로 절대 갱신하지 않는다.
   *
   * 기존 키가 발견되면 EdgeNode를 포함한 어떠한 데이터도
   * 수정하거나 생성하지 않고 즉시 종료한다.
   *
   * 키 교체는 별도의 명시적 키 회전 절차를 사용해야 한다.
   */
  const existingKey =
    await prisma.edgeNodeKey.findUnique({
      where: {
        keyId,
      },
      select: {
        edgeNodeId: true,
        isActive: true,
        revokedAt: true,
      },
    });

  if (existingKey) {
    console.log('');
    console.log('Edge API key bootstrap skipped.');
    console.log('REASON=KEY_ALREADY_EXISTS');
    console.log(`EDGE_KEY_ID=${keyId}`);
    console.log(
      `EDGE_NODE_ID=${existingKey.edgeNodeId}`,
    );
    console.log(
      `KEY_ACTIVE=${existingKey.isActive}`,
    );
    console.log(
      `KEY_REVOKED=${
        existingKey.revokedAt !== null
      }`,
    );

    return;
  }

  const edgeNode = await prisma.edgeNode.upsert({
    where: {
      code: edgeNodeCode,
    },
    update: {
      name: edgeNodeName,
      status: 'ACTIVE',
    },
    create: {
      code: edgeNodeCode,
      name: edgeNodeName,
      status: 'ACTIVE',
    },
  });

  const rawApiKey = createRawApiKey();

  await prisma.edgeNodeKey.create({
    data: {
      edgeNodeId: edgeNode.id,
      keyId,
      keyHash: hashApiKey(rawApiKey),
      isActive: true,
    },
  });

  console.log('');
  console.log('Edge API key bootstrap completed.');
  console.log('CREATED=true');
  console.log(`EDGE_NODE_CODE=${edgeNode.code}`);
  console.log(`EDGE_KEY_ID=${keyId}`);
  console.log(`EDGE_API_KEY=${rawApiKey}`);
  console.log('');
  console.log(
    'Save the API key before closing this output.',
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
