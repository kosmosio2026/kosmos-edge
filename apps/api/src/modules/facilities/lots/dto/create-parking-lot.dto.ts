import { IsArray, IsIn, IsNumber, IsOptional, IsString } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateParkingLotDto {
  @IsString()
  code!: string;

  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  region?: string;

  @IsOptional()
  @IsString()
  district?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  lat?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  lng?: number;

  @IsOptional()
  @IsString()
  representative?: string;

  @IsOptional()
  @IsString()
  contact?: string;

  @IsOptional()
  @IsArray()
  photos?: string[];

  @IsOptional()
  @IsIn(['SENSOR', 'MANUAL'])
  operationMode?: 'SENSOR' | 'MANUAL';
}
