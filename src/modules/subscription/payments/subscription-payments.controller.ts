import {
  BadRequestException,
  Body,
  Controller,
  Headers,
  HttpCode,
  HttpStatus,
  Post,
  Req,
} from '@nestjs/common';
import { CurrentUser, Public, RequireRole } from '../../../decorators/auth.decorator';
import { CreateSubscriptionCheckoutDto } from './dto/create-subscription-checkout.dto';
import { SubscriptionPaymentsService } from './subscription-payments.service';

type RawBodyRequest = { rawBody?: Buffer };

@Controller('subscription')
export class SubscriptionPaymentsController {
  constructor(private readonly payments: SubscriptionPaymentsService) {}

  @Post('checkout')
  @RequireRole('ADMIN')
  createCheckout(
    @CurrentUser() user: { tenantId: string | null },
    @Body() body: CreateSubscriptionCheckoutDto,
  ) {
    if (!user.tenantId) {
      throw new BadRequestException('Aucun tenant associe a ce compte.');
    }
    return this.payments.createCheckout(user.tenantId, body.billingCycle);
  }

  @Public()
  @Post('webhooks/notchpay')
  @HttpCode(HttpStatus.OK)
  webhook(
    @Req() request: RawBodyRequest,
    @Headers('x-notch-signature') signature: string | undefined,
    @Body() body: unknown,
  ) {
    if (!Buffer.isBuffer(request.rawBody)) {
      throw new BadRequestException({
        message: 'Corps brut du webhook indisponible.',
        errorCode: 'INVALID_PAYMENT_WEBHOOK',
      });
    }
    return this.payments.handleWebhook(request.rawBody, signature, body);
  }
}
