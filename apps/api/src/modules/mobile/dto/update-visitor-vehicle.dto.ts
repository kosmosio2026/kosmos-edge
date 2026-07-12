import { IsOptional, IsString } from 'class-validator';

export class UpdateVisitorVehicleDto {
  @IsOptional()
  @IsString()
  vehicleNo?: string;
}