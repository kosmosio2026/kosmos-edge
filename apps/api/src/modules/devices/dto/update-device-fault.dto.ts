import { FaultStatus, FaultSeverity } from '@parking/db';
import { IsEnum, IsOptional, IsString } from 'class-validator';

export class UpdateDeviceFaultDto {
  @IsOptional()
  @IsEnum(FaultSeverity)
  severity?: FaultSeverity;

  @IsOptional()
  @IsEnum(FaultStatus)
  status?: FaultStatus;

  @IsOptional()
  @IsString()
  assignedToUserId?: string;

  @IsOptional()
  @IsString()
  actionTaken?: string;

  @IsOptional()
  @IsString()
  actionResult?: string;
}