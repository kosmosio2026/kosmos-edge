import {
  IsBoolean,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

const BENEFIT_TYPES = [
  'PERCENT',
  'FIXED_AMOUNT',
  'FREE_MINUTES',
  'FULL_WAIVER',
] as const;

export class CreateTenantCouponProductDto {
  @IsString()
  @IsNotEmpty()
  parkingLotId!: string;

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

  @IsInt()
  @Min(0)
  salePrice!: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(24)
  validityMonths?: number;

  @IsOptional()
  @IsBoolean()
  stackableWithAutomaticDiscount?: boolean;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
