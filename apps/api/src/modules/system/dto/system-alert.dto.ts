export type AlertSeverity = 'INFO' | 'WARN' | 'CRITICAL';

export class SystemAlertDto {
  title!: string;
  message!: string;
  severity!: AlertSeverity;
  source!: string;
  tags?: string[];
}