import { IsInt, IsString, Min } from 'class-validator';

export class TossConfirmDto {
  @IsString()
  paymentKey!: string;

  @IsString()
  orderId!: string;

  @IsInt()
  @Min(0)
  amount!: number;
}