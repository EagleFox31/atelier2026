import { Controller, Get } from '@nestjs/common';
import { CurrentUser } from '../../decorators/auth.decorator';
import { SubscriptionService } from './subscription.service';

@Controller('subscription')
export class SubscriptionController {
  constructor(private readonly subscriptions: SubscriptionService) {}

  @Get('status')
  status(@CurrentUser() user: { tenantId: string | null }) {
    if (!user.tenantId) {
      return {
        status: 'ACTIVE',
        plan: 'platform',
        trialStartedAt: null,
        trialEndsAt: null,
        graceEndsAt: null,
        subscriptionStartedAt: null,
        subscriptionEndsAt: null,
        dataRetentionEndsAt: null,
        daysRemaining: null,
        readOnly: false,
        blocked: false,
      };
    }

    return this.subscriptions.getSummary(user.tenantId);
  }
}
