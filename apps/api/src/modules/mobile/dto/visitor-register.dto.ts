import { IsOptional, IsString, Matches } from 'class-validator';

export class VisitorRegisterDto {
  @IsString()
  phone!: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d{4,6}$/)
  pin?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d{4,6}$/)
  pinCode?: string;

  @IsOptional()
  @IsString()
  plateNumber?: string;
}
