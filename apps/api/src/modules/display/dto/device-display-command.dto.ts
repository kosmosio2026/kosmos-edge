import { IsBoolean, IsInt, IsOptional, Max, Min } from 'class-validator';

export class BrightnessCommandDto {
  @IsInt()
  @Min(1)
  @Max(10)
  brightness!: number;
}

export class PowerCommandDto {
  @IsBoolean()
  powerOn!: boolean;
}

export class TestCommandDto {
  @IsOptional()
  @IsBoolean()
  includeSave?: boolean;
}
