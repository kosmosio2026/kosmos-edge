import { IsInt, IsOptional, IsString, Min } from 'class-validator';

export class ConfirmPaymentDto {
  @IsString()
  invoiceId!: string;

  @IsString()
  orderId!: string;

  @IsInt()
  @Min(0)
  amount!: number;

  @IsOptional()
  @IsString()
  tossPaymentKey?: string;
}