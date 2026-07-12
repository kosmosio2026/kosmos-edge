import type { AuthUser } from '../../../common/types/auth-user.type';
import { PrismaService } from '../../../prisma/prisma.service';

export function getUserRoles(user?: AuthUser | null): string[] {
  const raw = (user as any)?.roles ?? (user as any)?.role ?? [];
  if (Array.isArray(raw)) return raw.map(String);
  if (raw) return [String(raw)];
  return [];
}

export function isAdmin(user?: AuthUser | null) {
  return getUserRoles(user).includes('ADMIN');
}

export function isManager(user?: AuthUser | null) {
  return getUserRoles(user).includes('MANAGER');
}

export function isOperator(user?: AuthUser | null) {
  return getUserRoles(user).includes('OPERATOR');
}

export async function getManagerParkingLotIds(
  prisma: PrismaService,
  userId: string,
) {
  const rows = await prisma.managerParkingLot.findMany({
    where: { managerProfileUserId: userId },
    select: { parkingLotId: true },
  });

  return rows.map((row) => row.parkingLotId);
}

export async function getOperatorParkingLotIds(
  prisma: PrismaService,
  userId: string,
) {
  const rows = await prisma.operatorParkingSection.findMany({
    where: { operatorProfileUserId: userId },
    select: { parkingLotId: true },
    distinct: ['parkingLotId'],
  });

  return rows.map((row) => row.parkingLotId);
}

export async function getOperatorParkingSectionIds(
  prisma: PrismaService,
  userId: string,
) {
  const rows = await prisma.operatorParkingSection.findMany({
    where: { operatorProfileUserId: userId },
    select: { sectionId: true },
  });

  return rows.map((row) => row.sectionId);
}
