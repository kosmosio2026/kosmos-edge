export type ParkingLotQrClient = {
  parkingLotQr: {
    findFirst(args: any): Promise<any>;
    findUnique(args: any): Promise<any>;
    create(args: any): Promise<any>;
  };
};

export type ParkingLotQrTarget = {
  id: string;
  code: string;
};

export function makeParkingLotQrToken(code: string) {
  const slug = String(code || 'parking-lot')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return `${slug || 'parking-lot'}-qr`;
}

export async function ensureActiveParkingLotQr(
  client: ParkingLotQrClient,
  parkingLot: ParkingLotQrTarget,
) {
  const existing = await client.parkingLotQr.findFirst({
    where: {
      parkingLotId: parkingLot.id,
      isActive: true,
    },
    select: {
      id: true,
      qrToken: true,
    },
  });

  if (existing) return existing;

  const baseToken = makeParkingLotQrToken(parkingLot.code);
  let qrToken = baseToken;
  let suffix = 1;

  while (true) {
    const duplicated = await client.parkingLotQr.findUnique({
      where: { qrToken },
      select: { id: true },
    });

    if (!duplicated) break;

    suffix += 1;
    qrToken = `${baseToken}-${suffix}`;
  }

  return client.parkingLotQr.create({
    data: {
      parkingLotId: parkingLot.id,
      qrToken,
      qrType: 'PARKING_LOT',
      isActive: true,
    },
    select: {
      id: true,
      qrToken: true,
    },
  });
}
