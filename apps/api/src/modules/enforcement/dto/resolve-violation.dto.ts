import { IsOptional, IsString } from 'class-validator';

export class ResolveViolationDto {
  @IsOptional()
  @IsString()
  note?: string;
}