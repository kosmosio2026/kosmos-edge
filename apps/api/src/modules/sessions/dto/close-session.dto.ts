import { IsInt, IsOptional, IsString, Min } from 'class-validator';

export class CloseSessionDto {
  @IsOptional()
  @IsInt()
  @Min(0)
  discountAmount?: number;

  @IsOptional()
  @IsString()
  note?: string;
}