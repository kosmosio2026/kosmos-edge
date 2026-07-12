import { IsObject, IsOptional, IsString } from 'class-validator';

export class CreateSensorEventDto {
  @IsOptional()
  @IsString()
  sensorDeviceId?: string;

  @IsOptional()
  @IsString()
  devEui?: string;

  @IsString()
  eventType!: string;

  @IsObject()
  payload!: Record<string, unknown>;
}