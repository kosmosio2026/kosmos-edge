import { IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class RequestMemberPasswordResetDto {
  @IsString()
  phone!: string;
}

export class ConfirmMemberPasswordResetDto {
  @IsString()
  phone!: string;

  @IsString()
  @Matches(/^\d{6}$/, {
    message: 'verificationCode must be a 6 digit number',
  })
  verificationCode!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(64)
  @Matches(/^(?=.*[A-Za-z])(?=.*\d).+$/, {
    message: 'newPassword must include letters and numbers',
  })
  newPassword!: string;

  @IsString()
  confirmPassword!: string;
}
