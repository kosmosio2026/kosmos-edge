import { IsObject, IsOptional, IsString } from 'class-validator';

export class CreateDisplayCommandDto {
  @IsString()
  type!: string;

  @IsOptional()
  @IsObject()
  payload?: Record<string, unknown>;
}
