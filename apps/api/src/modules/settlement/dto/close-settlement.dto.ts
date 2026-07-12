import { IsString } from 'class-validator';

export class CloseSettlementDto {
  @IsString()
  parkingLotId!: string;

  @IsString()
  businessDate!: string;
}