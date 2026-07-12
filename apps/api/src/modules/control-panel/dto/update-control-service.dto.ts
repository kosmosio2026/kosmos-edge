import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class UpdateControlServiceDto {
  @IsOptional()
  @IsString()
  @MaxLength(80)
  key?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  host?: string | null;

  @IsOptional()
  @IsInt()
  port?: number | null;

  @IsOptional()
  @IsIn(['systemctl', 'pm2'])
  commandType?: 'systemctl' | 'pm2';

  @IsOptional()
  @IsString()
  @MaxLength(160)
  targetName?: string;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @IsInt()
  sortOrder?: number;
}
