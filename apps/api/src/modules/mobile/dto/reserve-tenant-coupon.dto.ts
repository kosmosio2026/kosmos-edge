import { IsOptional, IsString } from 'class-validator';

export class ReserveTenantCouponDto {
  @IsString()
  sessionId!: string;
}

export class ReleaseTenantCouponDto {
  @IsOptional()
  @IsString()
  sessionId?: string;
}
