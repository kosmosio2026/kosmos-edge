import { IsIn } from 'class-validator';

export class ServiceActionDto {
  @IsIn(['start', 'stop', 'restart'])
  action!: 'start' | 'stop' | 'restart';
}
