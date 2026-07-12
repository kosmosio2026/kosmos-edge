import { IsNumber } from 'class-validator';

export class DeleteAdDto {
  @IsNumber()
  idx!: number;
}
