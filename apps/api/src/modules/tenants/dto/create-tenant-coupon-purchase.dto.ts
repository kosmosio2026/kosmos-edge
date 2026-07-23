import { IsInt, IsNotEmpty, IsOptional, IsString, Max, Min } from 'class-validator';

export class CreateTenantCouponPurchaseDto {
  @IsString()
  @IsNotEmpty()
  productId!: string;

  @IsInt()
  @Min(1)
  @Max(10000)
  quantity!: number;

  @IsOptional()
  @IsString()
  memo?: string;
}
