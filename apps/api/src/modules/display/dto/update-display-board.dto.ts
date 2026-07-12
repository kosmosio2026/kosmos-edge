import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { DisplayTransportType } from '@parking/db';

export class UpdateDisplayBoardDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  code?: string | null;

  @IsOptional()
  @IsString()
  deviceId?: string | null;

  @IsOptional()
  @IsString()
  macAddress?: string | null;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @IsEnum(DisplayTransportType)
  transport?: DisplayTransportType;

  @IsOptional()
  @IsString()
  tcpHost?: string | null;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(65535)
  tcpPort?: number | null;

  @IsOptional()
  @IsString()
  serialPort?: string | null;

  @IsOptional()
  @IsInt()
  @Min(300)
  @Max(921600)
  baudRate?: number | null;

  @IsOptional()
  @IsInt()
  @Min(5)
  @Max(8)
  dataBits?: number | null;

  @IsOptional()
  @IsString()
  parity?: string | null;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(2)
  stopBits?: number | null;

  @IsOptional()
  @IsInt()
  @Min(100)
  @Max(60000)
  connectTimeoutMs?: number;

  @IsOptional()
  @IsInt()
  @Min(100)
  @Max(60000)
  readTimeoutMs?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(16)
  rows?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(32)
  cols?: number;

  @IsOptional()
  @IsInt()
  moduleType?: number | null;

  @IsOptional()
  @IsInt()
  rgbOrder?: number | null;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10)
  brightness?: number | null;

  @IsOptional()
  @IsBoolean()
  powerOn?: boolean;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(3600)
  heartbeatIntervalSec?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(20)
  retryMaxAttempts?: number;

  @IsOptional()
  @IsInt()
  @Min(100)
  @Max(60000)
  retryBackoffMs?: number;
}
