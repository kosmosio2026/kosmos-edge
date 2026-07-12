import { IsOptional, IsString } from 'class-validator';

export class EnterSessionDto {
  @IsOptional()
  @IsString()
  userId?: string;

  @IsOptional()
  @IsString()
  vehicleId?: string;

  @IsString()
  parkingSpaceId!: string;

  @IsOptional()
  @IsString()
  entryGate?: string;

  @IsOptional()
  @IsString()
  feePolicyId?: string;
}