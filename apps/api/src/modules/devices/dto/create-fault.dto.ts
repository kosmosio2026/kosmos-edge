import { IsOptional, IsString } from 'class-validator';

export class CreateFaultDto {
  @IsString()
  sensorDeviceId!: string;

  @IsString()
  code!: string;

  @IsString()
  message!: string;

  @IsOptional()
  @IsString()
  severity?: string;
}