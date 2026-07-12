import { IsOptional, IsString } from 'class-validator';

export class RegisterOccupiedSpaceDto {
  @IsString()
  parkingSpaceId!: string;

  @IsOptional()
  @IsString()
  vehicleId?: string;

  @IsOptional()
  @IsString()
  plateNumber?: string;
}