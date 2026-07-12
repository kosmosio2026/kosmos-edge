import { FaultSeverity } from '@parking/db';
import { IsEnum, IsOptional, IsString } from 'class-validator';

export class CreateDeviceFaultDto {
  @IsString()
  sensorDeviceId!: string;

  @IsString()
  title!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  code?: string;

  @IsOptional()
  @IsEnum(FaultSeverity)
  severity?: FaultSeverity;
}