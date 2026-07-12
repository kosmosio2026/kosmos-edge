import { IsBoolean, IsObject, IsOptional, IsString } from 'class-validator';

export class UpsertManualOverrideDto {
  @IsBoolean()
  enabled!: boolean;

  @IsOptional()
  @IsString()
  reason?: string;

  @IsOptional()
  @IsObject()
  state?: Record<string, unknown>;
}