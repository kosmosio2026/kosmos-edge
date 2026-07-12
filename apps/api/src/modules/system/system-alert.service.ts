import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import { SystemAlertDto } from './dto/system-alert.dto';
import { SystemStatusService } from './system-status.service';

@Injectable()
export class SystemAlertService {
  private readonly logger = new Logger(SystemAlertService.name);

  constructor(
    private readonly systemStatusService: SystemStatusService,
  ) {}

  private readonly slackWebhookUrl = process.env.ALERT_SLACK_WEBHOOK_URL;
  private readonly smtpHost = process.env.ALERT_SMTP_HOST;
  private readonly smtpPort = Number(process.env.ALERT_SMTP_PORT ?? 587);
  private readonly smtpUser = process.env.ALERT_SMTP_USER;
  private readonly smtpPass = process.env.ALERT_SMTP_PASS;
  private readonly alertEmailTo = process.env.ALERT_EMAIL_TO;
  private readonly kakaoMode = process.env.ALERT_KAKAO_MODE ?? 'push';

  async fanout(alert: SystemAlertDto) {
    const tasks: Promise<unknown>[] = [];

    if (this.slackWebhookUrl) {
      tasks.push(this.sendSlack(alert));
    }

    if (this.smtpHost && this.smtpUser && this.smtpPass && this.alertEmailTo) {
      tasks.push(this.sendEmail(alert));
    }

    if (this.kakaoMode === 'push') {
      tasks.push(this.sendKakaoPush(alert));
    }

    await Promise.allSettled(tasks);
  }

  async evaluateAndAlert() {
    const snapshot = await this.systemStatusService.getSystemStatus();

    for (const service of snapshot.services) {
      if (service.status === 'DOWN') {
        await this.fanout({
          title: `${service.service} is DOWN`,
          message: service.detail,
          severity: 'CRITICAL',
          source: 'service-health',
          tags: [service.service],
        });
      }
    }

    for (const cert of snapshot.certificates) {
      if (cert.daysRemaining !== null && cert.daysRemaining <= 7) {
        await this.fanout({
          title: `${cert.name} certificate expires soon`,
          message: `${cert.host} · ${cert.daysRemaining} days remaining`,
          severity: cert.daysRemaining < 0 ? 'CRITICAL' : 'WARN',
          source: 'certificate-check',
          tags: [cert.host],
        });
      }
    }

    for (const hb of snapshot.displayHeartbeats) {
      if (hb.status === 'DOWN') {
        await this.fanout({
          title: `Display heartbeat lost`,
          message: `${hb.deviceId} · ${hb.lotName ?? '-'}`,
          severity: 'CRITICAL',
          source: 'display-heartbeat',
          tags: [hb.deviceId],
        });
      }
    }
  }

  private async sendSlack(alert: SystemAlertDto) {
    if (!this.slackWebhookUrl) return;

    await fetch(this.slackWebhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: `[${alert.severity}] ${alert.title}\n${alert.message}`,
      }),
    });
  }

  private async sendEmail(alert: SystemAlertDto) {
    const transporter = nodemailer.createTransport({
      host: this.smtpHost,
      port: this.smtpPort,
      secure: this.smtpPort === 465,
      auth: {
        user: this.smtpUser,
        pass: this.smtpPass,
      },
    });

    await transporter.sendMail({
      from: this.smtpUser,
      to: this.alertEmailTo,
      subject: `[${alert.severity}] ${alert.title}`,
      text: `${alert.message}\nsource=${alert.source}`,
    });
  }

  private async sendKakaoPush(alert: SystemAlertDto) {
    this.logger.log(`Kakao push placeholder: ${alert.title}`);
  }
}