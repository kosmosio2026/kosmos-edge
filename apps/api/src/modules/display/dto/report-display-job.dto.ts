import { IsOptional, IsString } from 'class-validator';

export class ReportDisplayJobDto {
  @IsString()
  status!: 'SENT' | 'ACKED' | 'FAILED';

  @IsOptional()
  @IsString()
  packetHex?: string;

  @IsOptional()
  @IsString()
  responseHex?: string;

  @IsOptional()
  @IsString()
  errorMessage?: string;
}
