import { IsOptional, IsString } from 'class-validator';

export class IssueReceiptDto {
  @IsOptional()
  @IsString()
  ownerName?: string;

  @IsOptional()
  @IsString()
  ownerPhone?: string;
}