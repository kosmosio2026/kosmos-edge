import {
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
} from 'class-validator';
import {
  MEMBER_VEHICLE_POWERTRAINS,
  MEMBER_VEHICLE_SIZE_CLASSES,
} from './member-signup.dto';

export class CreateMyVehicleDto {
  @IsString()
  plateNumber!: string;

  @IsIn(MEMBER_VEHICLE_SIZE_CLASSES)
  sizeClass!: (typeof MEMBER_VEHICLE_SIZE_CLASSES)[number];

  @IsIn(MEMBER_VEHICLE_POWERTRAINS)
  powertrainType!: (typeof MEMBER_VEHICLE_POWERTRAINS)[number];

  /** Legacy compatibility field. New code uses sizeClass/powertrainType. */
  @IsOptional()
  @IsString()
  vehicleType?: string;

  @IsOptional()
  @IsString()
  ownerName?: string;

  @IsOptional()
  @IsBoolean()
  isPrimary?: boolean;
}
