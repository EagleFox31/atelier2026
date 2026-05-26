import { Controller, Post, Body, Param, Get, Query, HttpCode } from '@nestjs/common';
import { BillingService } from './billing.service';
import { CurrentUser, RequirePermission } from '../../decorators/auth.decorator';
import { randomUUID } from 'crypto';
import { CreateQuoteDto, RecordPaymentDto } from './dto/billing.dto';

@Controller('billing')
export class BillingController {
  constructor(private readonly billingService: BillingService) {}

  @Post('quote/compute')
  @HttpCode(200)
  computeAmounts(@Body() body: { subtotal: number }) {
    return this.billingService.computeAmounts(body.subtotal);
  }

  @Get('quotes')
  @RequirePermission('FAC_CREATE')
  listQuotes(@Query('serviceOrderId') serviceOrderId?: string) {
    return this.billingService.listQuotes(serviceOrderId);
  }

  @Post('quotes')
  @RequirePermission('FAC_CREATE')
  createQuote(@CurrentUser() user: { id: string }, @Body() body: CreateQuoteDto) {
    return this.billingService.createQuote(body, user.id);
  }

  @Post('quotes/:quoteId/send')
  @RequirePermission('FAC_CREATE')
  @HttpCode(200)
  sendQuote(@Param('quoteId') quoteId: string) {
    return this.billingService.sendQuote(quoteId);
  }

  @Post('quotes/:quoteId/approve')
  @RequirePermission('FAC_CREATE')
  @HttpCode(200)
  approveQuote(
    @Param('quoteId') quoteId: string,
    @CurrentUser() user: { id: string },
    @Body() body: { clientApprovalMethod?: string; clientSignatureRef?: string },
  ) {
    return this.billingService.approveQuote(quoteId, body, user.id);
  }

  @Get('invoices')
  @RequirePermission('FAC_CREATE')
  listInvoices(
    @Query('customerId') customerId?: string,
    @Query('status') status?: string,
  ) {
    return this.billingService.listInvoices(customerId, status);
  }

  @Post('invoice/from-quote/:quoteId')
  @RequirePermission('FAC_CREATE')
  createInvoiceFromQuote(
    @Param('quoteId') quoteId: string,
    @CurrentUser() user: { id: string },
  ) {
    return this.billingService.createInvoiceFromQuote(quoteId, user.id);
  }

  @Post('payment')
  @RequirePermission('FAC_CREATE')
  recordPayment(@CurrentUser() user: { id: string }, @Body() body: RecordPaymentDto) {
    return this.billingService.recordPayment({
      invoiceId: body.invoiceId,
      amount: body.amount,
      method: body.method,
      userId: user.id,
      idempotencyKey: body.idempotencyKey ?? randomUUID(),
    });
  }

  @Get('quotes/:id')
  @RequirePermission('FAC_CREATE')
  getQuote(@Param('id') id: string) {
    return this.billingService.getQuote(id);
  }

  @Get('invoices/:id')
  @RequirePermission('FAC_CREATE')
  getInvoice(@Param('id') id: string) {
    return this.billingService.getInvoice(id);
  }
}
