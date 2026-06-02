import { Controller, Post, Body, Param, Get, Query, HttpCode } from '@nestjs/common';
import { BillingService } from './billing.service';
import { CurrentUser, RequirePermission, RequireRole } from '../../decorators/auth.decorator';
import { randomUUID } from 'crypto';
import { CloseCashDayDto, CreateQuoteDto, RecordPaymentDto } from './dto/billing.dto';

@Controller('billing')
export class BillingController {
  constructor(private readonly billingService: BillingService) {}

  @Post('quote/compute')
  @HttpCode(200)
  computeAmounts(@Body() body: { subtotal: number }) {
    return this.billingService.computeAmounts(body.subtotal);
  }

  @Get('quotes')
  @RequirePermission('FAC_VIEW')
  listQuotes(@CurrentUser() user: { garageId?: string | null }, @Query('serviceOrderId') serviceOrderId?: string) {
    return this.billingService.listQuotes(serviceOrderId, user?.garageId);
  }

  @Post('quotes')
  @RequirePermission('FAC_CREATE')
  createQuote(@CurrentUser() user: { id: string; garageId?: string | null }, @Body() body: CreateQuoteDto) {
    return this.billingService.createQuote(body, user.id, user.garageId);
  }

  @Post('quotes/:quoteId/send')
  @RequirePermission('FAC_CREATE')
  @HttpCode(200)
  sendQuote(@Param('quoteId') quoteId: string, @CurrentUser() user: { garageId?: string | null }) {
    return this.billingService.sendQuote(quoteId, user.garageId);
  }

  @Post('quotes/:quoteId/approve')
  @RequirePermission('FAC_CREATE')
  @HttpCode(200)
  approveQuote(
    @Param('quoteId') quoteId: string,
    @CurrentUser() user: { id: string; garageId?: string | null },
    @Body() body: { clientApprovalMethod?: string; clientSignatureRef?: string },
  ) {
    return this.billingService.approveQuote(quoteId, body, user.id, user.garageId);
  }

  @Get('invoices')
  @RequirePermission('FAC_VIEW')
  listInvoices(
    @CurrentUser() user: { garageId?: string | null },
    @Query('customerId') customerId?: string,
    @Query('status') status?: string,
  ) {
    return this.billingService.listInvoices(customerId, status, user?.garageId);
  }

  @Post('invoice/from-quote/:quoteId')
  @RequirePermission('FAC_CREATE')
  @RequireRole('CHEF_ATELIER', 'ADMIN', 'SUPER_ADMIN')
  createInvoiceFromQuote(
    @Param('quoteId') quoteId: string,
    @CurrentUser() user: { id: string; garageId?: string | null },
  ) {
    return this.billingService.createInvoiceFromQuote(quoteId, user.id, user.garageId);
  }

  @Post('payment')
  @RequirePermission('FAC_PAY')
  recordPayment(@CurrentUser() user: { id: string; garageId?: string | null }, @Body() body: RecordPaymentDto) {
    return this.billingService.recordPayment({
      invoiceId: body.invoiceId,
      amount: body.amount,
      method: body.method,
      userId: user.id,
      idempotencyKey: body.idempotencyKey ?? randomUUID(),
      garageId: user.garageId,
    });
  }

  @Get('quotes/:id')
  @RequirePermission('FAC_VIEW')
  getQuote(@Param('id') id: string, @CurrentUser() user: { garageId?: string | null }) {
    return this.billingService.getQuote(id, user.garageId);
  }

  @Get('invoices/:id')
  @RequirePermission('FAC_VIEW')
  getInvoice(@Param('id') id: string, @CurrentUser() user: { garageId?: string | null }) {
    return this.billingService.getInvoice(id, user.garageId);
  }

  @Get('cash-closure/summary')
  @RequirePermission('FAC_VIEW')
  getCashClosureSummary(
    @CurrentUser() user: { garageId?: string | null },
    @Query('date') date?: string,
  ) {
    return this.billingService.getCashClosureSummary(date, user.garageId);
  }

  @Post('cash-closure')
  @RequirePermission('FAC_PAY')
  closeCashDay(@CurrentUser() user: { id: string; garageId?: string | null }, @Body() body: CloseCashDayDto) {
    return this.billingService.closeCashDay({
      userId: user.id,
      dateIso: body.date,
      countedCash: body.countedCash,
      notes: body.notes,
      garageId: user.garageId,
    });
  }
}
