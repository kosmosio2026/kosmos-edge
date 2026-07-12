import { IsBoolean, IsDateString, IsInt, IsOptional, IsString, Min } from 'class-validator';

export class CreateSubscriptionDto {
  @IsString()
  userId!: string;

  @IsString()
  parkingLotId!: string;

  @IsOptional()
  @IsString()
  vehicleId?: string;

  @IsString()
  planName!: string;

  @IsInt()
  @Min(0)
  amount!: number;

  @IsDateString()
  startDate!: string;

  @IsDateString()
  endDate!: string;

  @IsOptional()
  @IsBoolean()
  autoRenew?: boolean;
}