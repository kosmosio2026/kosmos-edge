import {
  IsBoolean,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

const BENEFIT_TYPES = [
  'PERCENT',
  'FIXED_AMOUNT',
  'FREE_MINUTES',
  'FULL_WAIVER',
] as const;

export class CreateParkingDiscountProgramDto {
  @IsString()
  @IsNotEmpty()
  parkingLotId!: string;

  @IsString()
  @IsNotEmpty()
  eligibilityCode!: string;

  @IsString()
  @IsNotEmpty()
  code!: string;

  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsIn(BENEFIT_TYPES)
  benefitType!: (typeof BENEFIT_TYPES)[number];

  @IsInt()
  @Min(0)
  benefitValue!: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  priority?: number;

  @IsOptional()
  @IsBoolean()
  stackable?: boolean;

  @IsOptional()
  @IsBoolean()
  stackableWithCoupon?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  maxDiscountAmount?: number | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  minimumPayableAmount?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsString()
  validFrom?: string | null;

  @IsOptional()
  @IsString()
  validUntil?: string | null;
}
