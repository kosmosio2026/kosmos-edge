import { IsIn, IsNumber, IsObject, IsOptional, IsString } from 'class-validator';

export class UpdateSpaceMapDto {
  @IsOptional()
  @IsNumber()
  lat?: number;

  @IsOptional()
  @IsNumber()
  lng?: number;

  @IsOptional()
  @IsNumber()
  posX?: number;

  @IsOptional()
  @IsNumber()
  posY?: number;

  @IsOptional()
  @IsNumber()
  widthMeter?: number;

  @IsOptional()
  @IsNumber()
  heightMeter?: number;

  @IsOptional()
  @IsNumber()
  rotationDeg?: number;

  @IsOptional()
  @IsString()
  @IsIn(['REGULAR', 'EV', 'HANDICAPPED', 'PREGNANT', 'COMPACT', 'VIP', 'RESERVED'])
  type?: string;

  @IsOptional()
  @IsObject()
  polygonJson?: Record<string, unknown>;
}
