import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { InvoicesService } from './invoices.service';

@Controller('invoices')
export class InvoicesController {
  constructor(private readonly invoicesService: InvoicesService) {}

  @Get('unpaid')
  async listUnpaidInvoices(
    @Query('parkingLotId') parkingLotId?: string,
    @Query('limit') limit?: string,
  ) {
    return this.invoicesService.listUnpaidInvoices({
      parkingLotId,
      limit: limit ? Number(limit) : undefined,
    });
  }

  @Get(':invoiceId/public')
  async getPublicInvoice(@Param('invoiceId') invoiceId: string) {
    return this.invoicesService.getPublicInvoice(invoiceId);
  }
  @Post(':invoiceId/mock-pay')
  async mockPayInvoice(
    @Param('invoiceId') invoiceId: string,
    @Body()
    body: {
      amount?: number;
      method?: string;
      reference?: string;
    },
  ) {
    return this.invoicesService.mockPayInvoice({
      invoiceId,
      amount: body?.amount,
      method: body?.method,
      reference: body?.reference,
    });
  }

  @Post(':invoiceId/payment-request-message')
  async getPaymentRequestMessage(
    @Param('invoiceId') invoiceId: string,
    @Body()
    body: {
      baseUrl?: string;
    },
  ) {
    return this.invoicesService.getPaymentRequestMessage({
      invoiceId,
      baseUrl: body?.baseUrl,
    });
  }

  @Post(':invoiceId/payment-link')
  async createPaymentLink(
    @Param('invoiceId') invoiceId: string,
    @Body()
    body: {
      baseUrl?: string;
      channel?: string;
      recipient?: string;
    },
  ) {
    return this.invoicesService.createPaymentLink({
      invoiceId,
      baseUrl: body?.baseUrl,
      channel: body?.channel,
      recipient: body?.recipient,
    });
  }

  @Post(':invoiceId/send-sms')
  async sendSms(
    @Param('invoiceId') invoiceId: string,
    @Body()
    body: {
      recipient?: string;
      baseUrl?: string;
      message?: string;
    },
  ) {
    return this.invoicesService.sendInvoiceSms({
      invoiceId,
      recipient: body?.recipient,
      baseUrl: body?.baseUrl,
      message: body?.message,
    });
  }

  @Post(':invoiceId/send-email')
  async sendEmail(
    @Param('invoiceId') invoiceId: string,
    @Body()
    body: {
      recipient?: string;
      baseUrl?: string;
      subject?: string;
      message?: string;
    },
  ) {
    return this.invoicesService.sendInvoiceEmail({
      invoiceId,
      recipient: body?.recipient,
      baseUrl: body?.baseUrl,
      subject: body?.subject,
      message: body?.message,
    });
  }

  @Post(':invoiceId/collection-action')
  async recordCollectionAction(
    @Param('invoiceId') invoiceId: string,
    @Body()
    body: {
      action: string;
      channel?: string;
      recipient?: string;
      note?: string;
      metadata?: Record<string, unknown>;
    },
  ) {
    return this.invoicesService.recordCollectionAction({
      invoiceId,
      action: body.action,
      channel: body.channel,
      recipient: body.recipient,
      note: body.note,
      metadata: body.metadata,
    });
  }
}