import {
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class UpdateDisplayModuleItemDto {
  @IsInt()
  @Min(1)
  rowNo!: number;

  @IsInt()
  @Min(1)
  colNo!: number;

  @IsOptional()
  @IsString()
  parkingSectionId?: string | null;

  @IsOptional()
  @IsString()
  label?: string | null;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(16)
  charWidth?: number;

  @IsOptional()
  @IsString()
  padChar?: string;
}

export class UpdateDisplayModulesDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UpdateDisplayModuleItemDto)
  modules!: UpdateDisplayModuleItemDto[];
}
