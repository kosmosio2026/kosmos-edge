import { IsOptional, IsString } from 'class-validator';

export class ResetVisitorPinDto {
  @IsString()
  phone!: string;

  @IsString()
  pin!: string;

  @IsOptional()
  @IsString()
  pinCode?: string;

  @IsOptional()
  @IsString()
  code?: string;

  @IsOptional()
  @IsString()
  verificationCode?: string;

  @IsOptional()
  @IsString()
  phoneVerificationCode?: string;
}
