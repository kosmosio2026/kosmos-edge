import { IsOptional, IsString } from 'class-validator';

export class TossWebhookDto {
  @IsOptional()
  @IsString()
  eventType?: string;

  @IsOptional()
  @IsString()
  paymentKey?: string;

  @IsOptional()
  @IsString()
  orderId?: string;

  @IsOptional()
  status?: unknown;

  @IsOptional()
  data?: unknown;
}