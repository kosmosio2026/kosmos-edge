import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionGuard } from '../../common/guards/permission.guard';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthUser } from '../../common/types/auth-user.type';

import { PaymentsService } from './payments.service';
import { ConfirmPaymentDto } from './dto/confirm-payment.dto';
import { TossConfirmDto } from './dto/toss-confirm.dto';
import { TossWebhookDto } from './dto/toss-webhook.dto';
import { RefundPaymentDto } from './dto/refund-payment.dto';
import { ConfirmTossPaymentDto } from './dto/confirm-toss-payment.dto';
import { IssueReceiptDto } from './dto/issue-receipt.dto';
import { PublicConfirmTossPaymentDto } from './dto/public-confirm-toss-payment.dto';

type MockCompletePaymentDto = {
  sessionId: string;
  amount?: number;
  paymentMethod?: string;
  paymentReference?: string;
};

@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post('mock/complete')
  @UseGuards(JwtAuthGuard)
  mockCompletePayment(
    @CurrentUser() user: AuthUser,
    @Body() dto: MockCompletePaymentDto,
) {
  return this.paymentsService.mockCompleteSessionPayment(user.sub, dto);
}

  @Post('confirm')
  @UseGuards(JwtAuthGuard, PermissionGuard)
  @RequirePermission('payment.manage')
  confirm(@Body() dto: ConfirmPaymentDto) {
    return this.paymentsService.confirm(dto);
  }

  @Public()
  @Post('invoice/:invoiceId/toss/prepare')
  async preparePublicTossPayment(@Param('invoiceId') invoiceId: string) {
    const payment = await this.paymentsService.createPendingPayment(invoiceId);

    return {
      ok: true,
      payment: {
        id: payment.id,
        orderId: payment.orderId,
        invoiceId: payment.invoiceId,
        amount: payment.amount,
        status: payment.status,
      },
    };
  }

  @Public()
  @Post('invoice/:invoiceId/toss/cancel')
  cancelPublicTossPayment(
    @Param('invoiceId') invoiceId: string,
    @Body()
    dto: {
      code?: string | null;
      orderId?: string | null;
      reason?: string | null;
    },
  ) {
    return this.paymentsService.cancelPublicTossPayment(invoiceId, dto);
  }

  @Post('invoice/:invoiceId/create-pending')
  @UseGuards(JwtAuthGuard, PermissionGuard)
  @RequirePermission('payment.manage')
  createPending(@Param('invoiceId') invoiceId: string) {
    return this.paymentsService.createPendingPayment(invoiceId);
  }

  @Post('toss/admin-confirm')
  @UseGuards(JwtAuthGuard, PermissionGuard)
  @RequirePermission('payment.manage')
  tossAdminConfirm(@Body() dto: TossConfirmDto) {
    return this.paymentsService.tossConfirm(dto);
  }

  @Post('toss/confirm')
  @UseGuards(JwtAuthGuard)
  confirmTossPayment(
    @CurrentUser() user: AuthUser,
    @Body() dto: ConfirmTossPaymentDto,
  ) {
    return this.paymentsService.confirmTossPayment(user.sub, dto);
  }

  @Public()
  @Post('toss/public-confirm')
  publicConfirmTossPayment(@Body() dto: PublicConfirmTossPaymentDto) {
    return this.paymentsService.publicConfirmTossPayment(dto);
  }

  @Post(':paymentId/refund')
  @UseGuards(JwtAuthGuard, PermissionGuard)
  @RequirePermission('payment.manage')
  refund(
    @Param('paymentId') paymentId: string,
    @Body() dto: RefundPaymentDto,
  ) {
    return this.paymentsService.refund(paymentId, dto.reason);
  }

  @Post('kakao/ready')
ready(
@Body() dto:any
){
return this.paymentsService
.kakaoReady(dto);
}

@Post('kakao/approve')
approve(
@Body() dto:any
){
return this.paymentsService
.kakaoApprove(dto);
}

  @Post(':paymentId/receipt')
  @UseGuards(JwtAuthGuard, PermissionGuard)
  @RequirePermission('receipt.issue')
  issueReceipt(
    @CurrentUser() user: AuthUser,
    @Param('paymentId') paymentId: string,
    @Body() dto: IssueReceiptDto,
  ) {
    return this.paymentsService.issueReceipt(paymentId, user.sub, dto);
  }

  @Post('me/receipts/claim/:paymentId')
  @UseGuards(JwtAuthGuard)
  claimMyReceipt(
    @CurrentUser() user: AuthUser,
    @Param('paymentId') paymentId: string,
  ) {
    return this.paymentsService.claimMyReceipt(user.sub, paymentId);
  }

  @Get('me/receipts')
  @UseGuards(JwtAuthGuard)
  myReceipts(@CurrentUser() user: AuthUser) {
    return this.paymentsService.getMyReceipts(user.sub);
  }

  @Get('me/receipts/:receiptId')
  @UseGuards(JwtAuthGuard)
  myReceiptDetail(
    @CurrentUser() user: AuthUser,
    @Param('receiptId') receiptId: string,
  ) {
    return this.paymentsService.getReceiptById(receiptId, user.sub);
  }

  @Public()
  @Post('toss/webhook')
  webhook(@Body() dto: TossWebhookDto) {
    return this.paymentsService.webhook(dto);
  }
}