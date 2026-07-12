import { IsInt, IsString, Min } from 'class-validator';

export class PublicConfirmTossPaymentDto {
  @IsString()
  paymentKey!: string;

  @IsString()
  orderId!: string;

  @IsInt()
  @Min(0)
  amount!: number;

  @IsString()
  invoiceId!: string;
}
