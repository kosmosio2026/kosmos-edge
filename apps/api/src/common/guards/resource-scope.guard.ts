import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';

@Injectable()
export class ResourceScopeGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException('User not found');
    }

    if (user.roles?.includes('ADMIN')) {
      return true;
    }

    const parkingLotId =
      request.params?.parkingLotId ??
      request.query?.parkingLotId ??
      request.body?.parkingLotId;

    const parkingSectionId =
      request.params?.parkingSectionId ??
      request.query?.parkingSectionId ??
      request.body?.parkingSectionId;

    const parkingSpaceId =
      request.params?.parkingSpaceId ??
      request.query?.parkingSpaceId ??
      request.body?.parkingSpaceId;

    if (
      parkingLotId &&
      !user.scopes?.parkingLotIds?.includes(parkingLotId)
    ) {
      throw new ForbiddenException('Parking lot scope denied');
    }

    if (
      parkingSectionId &&
      !user.scopes?.parkingSectionIds?.includes(parkingSectionId) &&
      !user.scopes?.parkingLotIds?.length
    ) {
      throw new ForbiddenException('Parking section scope denied');
    }

    if (
      parkingSpaceId &&
      !user.scopes?.parkingSpaceIds?.includes(parkingSpaceId) &&
      !user.scopes?.parkingSectionIds?.length &&
      !user.scopes?.parkingLotIds?.length
    ) {
      throw new ForbiddenException('Parking space scope denied');
    }

    return true;
  }
}