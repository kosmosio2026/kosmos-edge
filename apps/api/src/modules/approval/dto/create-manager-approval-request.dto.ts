import { IsOptional, IsString } from 'class-validator';

export class CreateManagerApprovalRequestDto {
  @IsOptional()
  @IsString()
  parkingLotId?: string;

  @IsOptional()
  @IsString()
  note?: string;
}