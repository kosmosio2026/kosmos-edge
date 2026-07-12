import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class CreateSectionDto {
  @IsString()
  parkingLotId!: string;

  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  code?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
