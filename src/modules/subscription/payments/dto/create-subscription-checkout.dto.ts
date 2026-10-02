import { IsIn } from 'class-validator';
import type { BillingCycle } from '../payment-provider';

export class CreateSubscriptionCheckoutDto {
  @IsIn(['monthly', 'annual'])
  billingCycle!: BillingCycle;
}
