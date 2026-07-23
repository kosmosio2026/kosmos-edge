import {
  IsBoolean,
  IsIn,
  IsInt,
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

export class UpdateParkingDiscountProgramDto {
  @IsOptional()
  @IsString()
  eligibilityCode?: string;

  @IsOptional()
  @IsString()
  code?: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string | null;

  @IsOptional()
  @IsIn(BENEFIT_TYPES)
  benefitType?: (typeof BENEFIT_TYPES)[number];

  @IsOptional()
  @IsInt()
  @Min(0)
  benefitValue?: number;

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
