import { DeviceStatus } from '@parking/db';
import { IsEnum, IsOptional, IsString } from 'class-validator';

export enum SensorDeviceType {
  PARKING_SENSOR = 'PARKING_SENSOR',
  IO_CONTROLLER = 'IO_CONTROLLER',
  DISPLAY_BOARD = 'DISPLAY_BOARD',
  SMART_TRACKER = 'SMART_TRACKER',
  SENSIO_CONTROLLER = 'SENSIO_CONTROLLER',
}

export class CreateSensorDeviceDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsEnum(SensorDeviceType)
  type!: SensorDeviceType;

  @IsString()
  serialNumber!: string;

  @IsOptional()
  @IsString()
  devEui?: string;

  @IsOptional()
  @IsString()
  macAddress?: string;

  @IsOptional()
  @IsString()
  ipAddress?: string;

  @IsOptional()
  @IsString()
  installLocation?: string;

  @IsOptional()
  @IsEnum(DeviceStatus)
  status?: DeviceStatus;

  @IsOptional()
  @IsString()
  parkingSpaceId?: string;
}
