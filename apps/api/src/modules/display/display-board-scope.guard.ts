import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import type { AuthUser } from '../../common/types/auth-user.type';

const ADMIN_ROLES = new Set([
  'ADMIN',
  'SUPER_ADMIN',
  'SYSTEM_ADMIN',
]);

@Injectable()
export class DisplayBoardScopeGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user as AuthUser | undefined;

    if (!user) {
      throw new ForbiddenException('인증 사용자 정보가 없습니다.');
    }

    if (user.roles?.some((role) => ADMIN_ROLES.has(role))) {
      return true;
    }

    const allowedParkingLotIds =
      user.scopes?.parkingLotIds ?? [];

    let parkingLotId =
      typeof request.query?.parkingLotId === 'string'
        ? request.query.parkingLotId
        : undefined;

    const boardId =
      typeof request.params?.id === 'string'
        ? request.params.id
        : undefined;

    if (!parkingLotId && boardId) {
      const board =
        await this.prisma.displayBoard.findUnique({
          where: { id: boardId },
          select: { parkingLotId: true },
        });

      parkingLotId = board?.parkingLotId;
    }

    /*
     * 목록 API에서 parkingLotId가 생략된 경우에는
     * DisplayService.listBoards()가 사용자 범위로 필터링한다.
     */
    if (!parkingLotId) {
      return true;
    }

    if (!allowedParkingLotIds.includes(parkingLotId)) {
      throw new ForbiddenException(
        '해당 주차장의 전광판에 접근할 권한이 없습니다.',
      );
    }

    return true;
  }
}
