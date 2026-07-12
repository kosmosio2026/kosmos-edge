import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
} from 'class-validator';

export class CreateFeePolicyDto {
  @IsString()
  parkingLotId!: string;

  @IsOptional()
  @IsString()
  code?: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsString()
  vehicleType!: string;

  @IsInt()
  baseMinutes!: number;

  @IsInt()
  baseFee!: number;

  @IsInt()
  unitMinutes!: number;

  @IsInt()
  unitFee!: number;

  @IsOptional()
  @IsInt()
  dailyMax?: number;

  @IsOptional()
  @IsInt()
  graceMinutes?: number;

  @IsOptional()
  @IsInt()
  exitGraceMinutes?: number;

  @IsOptional()
  @IsInt()
  registrationGraceMinutes?: number;

  @IsOptional()
  @IsInt()
  registrationGraceFee?: number;

  @IsOptional()
  @IsBoolean()
  registrationGraceDiscountEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  authorityRegistrationGraceDiscountEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  watcherRewardGraceFeeEnabled?: boolean;

  @IsOptional()
  @IsInt()
  memberDiscountPercent?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
