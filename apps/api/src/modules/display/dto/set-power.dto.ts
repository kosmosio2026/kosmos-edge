import { IsBoolean } from 'class-validator';

export class SetPowerDto {
  @IsBoolean()
  on!: boolean;
}
