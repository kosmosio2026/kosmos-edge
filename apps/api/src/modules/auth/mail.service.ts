import { Injectable, Logger } from '@nestjs/common';

type SendEmailInput = {
  to: string;
  subject: string;
  html: string;
  text?: string;
};

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);

  async sendEmail(input: SendEmailInput): Promise<void> {
    /*
     First implementation logs only.
     Naver/Daum SMTP transport will be connected in the next mail batch.
    */
    this.logger.log(`Email queued to=${input.to} subject=${input.subject}`);
  }
}