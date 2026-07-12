import { IsNumber } from 'class-validator';

export class SetBrightnessDto {
  @IsNumber()
  level!: number;
}
