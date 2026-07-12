import { IsOptional, IsString } from 'class-validator';

export class MobileMapQueryDto {
  @IsOptional()
  @IsString()
  parkingLotId?: string;
}