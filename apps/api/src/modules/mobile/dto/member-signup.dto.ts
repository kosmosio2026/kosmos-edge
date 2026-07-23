import {
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';

export const MEMBER_VEHICLE_SIZE_CLASSES = [
  'GENERAL',
  'COMPACT',
  'VAN',
  'TRUCK',
  'MOTORCYCLE',
  'OTHER',
] as const;

export const MEMBER_VEHICLE_POWERTRAINS = [
  'ICE',
  'HYBRID',
  'PHEV',
  'EV',
  'HYDROGEN',
  'OTHER',
] as const;

export class MemberSignupDto {
  @IsString()
  name!: string;

  @IsString()
  phone!: string;

  @IsString()
  vehiclePlateNumber!: string;

  @IsIn(MEMBER_VEHICLE_SIZE_CLASSES)
  sizeClass!: (typeof MEMBER_VEHICLE_SIZE_CLASSES)[number];

  @IsIn(MEMBER_VEHICLE_POWERTRAINS)
  powertrainType!: (typeof MEMBER_VEHICLE_POWERTRAINS)[number];

  @IsString()
  @MinLength(6)
  password!: string;

  @IsString()
  phoneVerificationCode!: string;

  @IsBoolean()
  phoneVerified!: boolean;

  @IsBoolean()
  agreeTerms!: boolean;

  @IsOptional()
  @IsBoolean()
  disabledEligible?: boolean;

  @IsOptional()
  @IsBoolean()
  pregnantEligible?: boolean;

  @IsOptional()
  @IsBoolean()
  veteranEligible?: boolean;
}
