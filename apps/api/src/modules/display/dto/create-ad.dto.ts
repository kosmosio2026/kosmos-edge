import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class CreateAdDto {
  @IsString()
  dataString!: string;

  @IsOptional()
  @IsBoolean()
  rst?: boolean;

  @IsOptional()
  @IsBoolean()
  evt?: boolean;
}
