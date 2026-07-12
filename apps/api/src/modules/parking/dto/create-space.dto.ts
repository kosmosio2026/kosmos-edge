import { IsBoolean, IsEnum, IsOptional, IsString } from 'class-validator';
import { SpaceStatus, SpaceType } from '@parking/db';

export class CreateSpaceDto {
  @IsString()
  sectionId!: string;

  @IsString()
  code!: string;

  @IsOptional()
  @IsString()
  number?: string;

  @IsOptional()
  @IsEnum(SpaceType)
  type?: SpaceType;

  @IsOptional()
  @IsEnum(SpaceStatus)
  status?: SpaceStatus;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}