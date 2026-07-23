import { IsOptional, IsString } from 'class-validator';

export class MemberLoginDto {
  @IsOptional()
  @IsString()
  loginId?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsString()
  password!: string;
}
