import { IsInt, IsOptional, IsString } from 'class-validator';

export class DisplayErrorReportDto {
  @IsString()
  code!: string;

  @IsString()
  message!: string;

  @IsOptional()
  @IsInt()
  attempt?: number;

  @IsOptional()
  @IsString()
  interface?: string;

  @IsOptional()
  @IsString()
  transport?: string;

  @IsOptional()
  @IsInt()
  stateRevision?: number;

  @IsOptional()
  @IsString()
  timestamp?: string;
}