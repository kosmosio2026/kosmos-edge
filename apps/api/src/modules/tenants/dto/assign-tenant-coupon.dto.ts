import { IsNotEmpty, IsString } from 'class-validator';

export class AssignTenantCouponDto {
  @IsString()
  @IsNotEmpty()
  productId!: string;

  @IsString()
  @IsNotEmpty()
  memberUserId!: string;
}
