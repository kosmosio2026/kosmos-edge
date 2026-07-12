import { SpaceStatus, SpaceType } from '@parking/db';
import {
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class CreateSpaceDto {
  @IsString()
  sectionId!: string;

  @IsString()
  @MaxLength(50)
  code!: string;

  @IsOptional()
  @IsString()
  number?: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsEnum(SpaceType)
  type?: SpaceType = SpaceType.REGULAR;

  @IsOptional()
  @IsEnum(SpaceStatus)
  status?: SpaceStatus = SpaceStatus.EMPTY;

  @IsOptional()
  lat?: number;

  @IsOptional()
  lng?: number;

  @IsOptional()
  isActive?: boolean = true;
}