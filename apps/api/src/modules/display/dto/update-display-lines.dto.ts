import { IsArray, IsBoolean, IsInt, IsOptional, IsString, Max, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class DisplayLineInputDto {
  @IsInt()
  @Min(1)
  @Max(4)
  lineNo!: number;

  @IsString()
  textTemplate!: string;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @IsInt()
  fontSize?: number;

  @IsOptional()
  @IsString()
  effect?: string;

  @IsOptional()
  @IsInt()
  speed?: number;

  @IsOptional()
  @IsInt()
  delay?: number;

  @IsOptional()
  @IsInt()
  colorCode?: number;
}

export class UpdateDisplayLinesDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DisplayLineInputDto)
  lines!: DisplayLineInputDto[];
}
