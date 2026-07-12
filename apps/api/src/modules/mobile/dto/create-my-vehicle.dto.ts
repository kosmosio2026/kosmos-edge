import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class CreateMyVehicleDto {
  @IsString()
  plateNumber!: string;

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