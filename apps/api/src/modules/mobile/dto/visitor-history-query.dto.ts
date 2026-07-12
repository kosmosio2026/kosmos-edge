import { IsString, Length, Matches } from 'class-validator';

export class VisitorHistoryQueryDto {
  @IsString()
  phone!: string;

  @IsString()
  @Length(4, 4)
  @Matches(/^\d{4}$/)
  pin!: string;
}