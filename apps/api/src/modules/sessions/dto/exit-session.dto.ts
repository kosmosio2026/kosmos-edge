import { IsOptional, IsString } from 'class-validator';

export class ExitSessionDto {
  @IsOptional()
  @IsString()
  exitGate?: string;
}