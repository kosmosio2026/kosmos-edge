import { IsInt, IsNotEmpty, IsOptional, IsString, Min } from 'class-validator';

export class ConfirmTenantCouponPaymentDto {
  @IsInt()
  @Min(0)
  paidAmount!: number;

  @IsString()
  @IsNotEmpty()
  paymentReference!: string;

  @IsOptional()
  @IsString()
  memo?: string;
}
