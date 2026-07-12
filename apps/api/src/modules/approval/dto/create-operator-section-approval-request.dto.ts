import { IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateOperatorSectionApprovalRequestDto {
  @IsUUID()
  requestedParkingLotId!: string;

  @IsUUID()
  requestedSectionId!: string;

  @IsOptional()
  @IsString()
  note?: string;
}