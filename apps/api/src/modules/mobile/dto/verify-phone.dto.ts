import { IsString } from 'class-validator';

export class VerifyPhoneDto {
  @IsString()
  phone!: string;

  @IsString()
  code!: string;
}