import { IsNumber, IsObject, IsOptional } from 'class-validator';

export class UpdateSectionMapDto {
  @IsOptional()
  @IsNumber()
  centerLat?: number;

  @IsOptional()
  @IsNumber()
  centerLng?: number;

  @IsOptional()
  @IsObject()
  polygonJson?: Record<string, unknown>;
}