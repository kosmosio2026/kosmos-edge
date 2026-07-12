import { IsOptional, IsString } from 'class-validator';

export class CreateOperatorApprovalRequestDto {
  @IsString()
  parkingLotId!: string;

  @IsString()
  parkingSectionId!: string;

  @IsOptional()
  @IsString()
  note?: string;
}