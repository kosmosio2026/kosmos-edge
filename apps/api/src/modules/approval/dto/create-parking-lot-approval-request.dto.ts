import { IsIn, IsOptional, IsString } from 'class-validator';

export class CreateParkingLotApprovalRequestDto {
  @IsOptional()
  @IsIn(['PARKING_LOT_ACCESS', 'PARKING_LOT_CREATION'])
  type?: 'PARKING_LOT_ACCESS' | 'PARKING_LOT_CREATION';

  @IsOptional()
  @IsString()
  requestedParkingLotId?: string;

  @IsOptional()
  @IsString()
  requestedParkingLotName?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  note?: string;

  @IsOptional()
  @IsString()
  reason?: string;

  @IsOptional()
  @IsString()
  requestReason?: string;
}
