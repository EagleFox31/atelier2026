import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  Inject,
  Injectable,
  Logger,
} from '@nestjs/common';
import { SubscriptionStatus } from '@prisma/client';
import { createHash, randomUUID } from 'crypto';
import { PrismaService } from '../../../shared/prisma/prisma.service';
import {
  PAYMENT_PROVIDER,
  type BillingCycle,
  type PaymentProvider,
  type PaymentWebhookEvent,
  type RetrievedPayment,
} from './payment-provider';

const PRO_MONTHLY_XAF = 45_000;
const PRO_ANNUAL_XAF = 450_000;
const ADDITIONAL_GARAGE_MONTHLY_XAF = 20_000;

export function calculateProPrice(billingCycle: BillingCycle, garageCount: number): number {
  const normalizedGarageCount = Math.max(1, Math.trunc(garageCount));
  const additionalGarages = Math.max(0, normalizedGarageCount - 1);
  const base = billingCycle === 'annual' ? PRO_ANNUAL_XAF : PRO_MONTHLY_XAF;
  const additionalPeriodPrice =
    additionalGarages * ADDITIONAL_GARAGE_MONTHLY_XAF * (billingCycle === 'annual' ? 12 : 1);
  return base + additionalPeriodPrice;
}

export function addBillingPeriod(start: Date, billingCycle: BillingCycle): Date {
  const end = new Date(start);
  const originalDay = end.getUTCDate();
  end.setUTCDate(1);
  if (billingCycle === 'annual') {
    const targetYear = end.getUTCFullYear() + 1;
    const targetMonth = end.getUTCMonth();
    const lastDay = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate();
    end.setUTCFullYear(targetYear, targetMonth, Math.min(originalDay, lastDay));
  } else {
    const monthIndex = end.getUTCMonth() + 1;
    const targetYear = end.getUTCFullYear() + Math.floor(monthIndex / 12);
    const targetMonth = monthIndex % 12;
    const lastDay = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate();
    end.setUTCFullYear(targetYear, targetMonth, Math.min(originalDay, lastDay));
  }
  return end;
}

@Injectable()
export class SubscriptionPaymentsService {
  private readonly logger = new Logger(SubscriptionPaymentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(PAYMENT_PROVIDER) private readonly provider: PaymentProvider,
  ) {}

  async createCheckout(tenantId: string, billingCycle: BillingCycle) {
    const tenant = await this.prisma.tenant.findUniqueOrThrow({
      where: { id: tenantId },
      select: {
        id: true,
        name: true,
        email: true,
        subscriptionStatus: true,
      },
    });
    if (tenant.subscriptionStatus === SubscriptionStatus.SUSPENDED) {
      throw new ForbiddenException({
        message: 'Un abonnement suspendu doit etre reactive par le support.',
        errorCode: 'SUBSCRIPTION_SUSPENDED',
      });
    }

    const garageCount = Math.max(
      1,
      await this.prisma.garage.count({ where: { tenantId, status: 'active' } }),
    );
    const amountXaf = calculateProPrice(billingCycle, garageCount);
    const reference = `sub_${randomUUID().replace(/-/g, '')}`;
    const payment = await this.prisma.subscriptionPayment.create({
      data: {
        tenantId,
        provider: this.provider.name,
        reference,
        plan: 'pro',
        billingCycle,
        garageCount,
        amountXaf,
        currency: 'XAF',
        status: 'PENDING',
      },
    });

    try {
      const initialized = await this.provider.initializePayment({
        amount: amountXaf,
        currency: 'XAF',
        email: tenant.email,
        customerName: tenant.name,
        description: `Atelier Maitre Pro - ${billingCycle === 'annual' ? 'annuel' : 'mensuel'}`,
        reference,
        callback: this.paymentReturnUrl(),
      });

      await this.prisma.subscriptionPayment.update({
        where: { id: payment.id },
        data: {
          providerTransactionId: initialized.providerTransactionId,
          authorizationUrl: initialized.authorizationUrl,
          providerStatus: initialized.providerStatus,
        },
      });

      return {
        paymentId: payment.id,
        reference,
        amountXaf,
        currency: 'XAF' as const,
        billingCycle,
        garageCount,
        authorizationUrl: initialized.authorizationUrl,
      };
    } catch (error) {
      await this.prisma.subscriptionPayment.updateMany({
        where: { id: payment.id, status: 'PENDING' },
        data: { status: 'FAILED', providerStatus: 'INITIALIZATION_FAILED' },
      });
      throw error;
    }
  }

  /**
   * Chaque refus ou événement ignoré est journalisé (code + identifiants, jamais le
   * corps ni un secret) : un paiement non appliqué ne doit jamais être silencieux
   * (LESSON-2026-013).
   */
  async handleWebhook(rawBody: Buffer, signature: string | undefined, payload: unknown) {
    if (!this.provider.verifyWebhookSignature(rawBody, signature)) {
      this.logger.warn(`Webhook ${this.provider.name} refusé : signature invalide ou absente`);
      throw new ForbiddenException({
        message: 'Signature webhook NotchPay invalide.',
        errorCode: 'INVALID_PAYMENT_WEBHOOK_SIGNATURE',
      });
    }

    let event: PaymentWebhookEvent | undefined;
    try {
      event = this.provider.parseWebhook(payload);
      const fingerprint = createHash('sha256').update(rawBody).digest('hex');
      const verifiedPayment =
        event.status === 'COMPLETE'
          ? await this.provider.retrievePayment(
              event.providerTransactionId ?? event.reference ?? '',
            )
          : null;

      const result = await this.applyWebhookEvent(fingerprint, event, verifiedPayment);
      if ('ignored' in result && result.ignored) {
        this.logger.warn(
          `Webhook ${event.type} ignoré : aucun paiement pour ${this.describe(event)}`,
        );
      } else {
        this.logger.log(`Webhook ${event.type} appliqué (${this.describe(event)}) : ${JSON.stringify(result)}`);
      }
      return result;
    } catch (error) {
      if (this.isUniqueConstraintError(error)) {
        return { received: true, duplicate: true, activated: false };
      }
      const errorCode =
        error instanceof HttpException
          ? ((error.getResponse() as { errorCode?: string }).errorCode ?? error.getStatus())
          : 'UNEXPECTED';
      this.logger.warn(
        `Webhook ${event?.type ?? '?'} refusé (${errorCode}) : ${event ? this.describe(event) : 'charge illisible'}`,
      );
      throw error;
    }
  }

  private describe(event: PaymentWebhookEvent): string {
    return `transaction=${event.providerTransactionId ?? '-'} référence=${event.reference ?? '-'} statut=${event.status}`;
  }

  private async applyWebhookEvent(
    fingerprint: string,
    event: PaymentWebhookEvent,
    verifiedPayment: RetrievedPayment | null,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const lookups = [
        ...(event.providerTransactionId
          ? [{ providerTransactionId: event.providerTransactionId }]
          : []),
        ...(event.reference ? [{ reference: event.reference }] : []),
      ];
      const payment = await tx.subscriptionPayment.findFirst({
        where: { provider: this.provider.name, OR: lookups },
      });

      if (!payment) {
        await tx.subscriptionPaymentEvent.create({
          data: {
            provider: this.provider.name,
            fingerprint,
            eventType: event.type,
          },
        });
        return { received: true, ignored: true, activated: false };
      }

      if (event.status === 'COMPLETE') {
        this.assertVerifiedPayment(payment, verifiedPayment);
      }

      await tx.subscriptionPaymentEvent.create({
        data: {
          subscriptionPaymentId: payment.id,
          provider: this.provider.name,
          fingerprint,
          eventType: event.type,
        },
      });

      if (event.status !== 'COMPLETE') {
        if (['FAILED', 'CANCELED', 'EXPIRED'].includes(event.status)) {
          await tx.subscriptionPayment.updateMany({
            where: { id: payment.id, status: { not: 'COMPLETE' } },
            data: { status: event.status, providerStatus: event.status },
          });
        }
        return { received: true, activated: false };
      }

      const markedComplete = await tx.subscriptionPayment.updateMany({
        where: { id: payment.id, status: { not: 'COMPLETE' } },
        data: {
          status: 'COMPLETE',
          providerStatus: verifiedPayment?.providerStatus ?? 'complete',
          paidAt: new Date(),
        },
      });
      if (markedComplete.count === 0) {
        return { received: true, duplicate: true, activated: false };
      }

      // Verrou de ligne jusqu'à la fin de la transaction : deux paiements DIFFÉRENTS
      // confirmés en même temps pour le même atelier doivent s'additionner. Sans lui,
      // les deux lisent la même échéance et l'un des deux mois payés est perdu.
      await tx.$queryRaw`SELECT id FROM tenants WHERE id = ${payment.tenantId}::uuid FOR UPDATE`;

      const tenant = await tx.tenant.findUniqueOrThrow({
        where: { id: payment.tenantId },
        select: {
          subscriptionStatus: true,
          subscriptionStartedAt: true,
          subscriptionEndsAt: true,
        },
      });
      if (tenant.subscriptionStatus === SubscriptionStatus.SUSPENDED) {
        return { received: true, activated: false, suspended: true };
      }

      const now = new Date();
      const periodStart =
        tenant.subscriptionEndsAt && tenant.subscriptionEndsAt.getTime() > now.getTime()
          ? tenant.subscriptionEndsAt
          : now;
      const subscriptionEndsAt = addBillingPeriod(
        periodStart,
        payment.billingCycle as BillingCycle,
      );

      await tx.tenant.update({
        where: { id: payment.tenantId },
        data: {
          plan: payment.plan,
          subscriptionStatus: SubscriptionStatus.ACTIVE,
          statusBeforeSuspension: null,
          subscriptionStartedAt: tenant.subscriptionStartedAt ?? now,
          subscriptionEndsAt,
          dataRetentionEndsAt: null,
        },
      });

      return {
        received: true,
        activated: true,
        subscriptionEndsAt: subscriptionEndsAt.toISOString(),
      };
    });
  }

  private assertVerifiedPayment(
    payment: {
      reference: string;
      providerTransactionId: string | null;
      amountXaf: number;
      currency: string;
    },
    verified: RetrievedPayment | null,
  ): asserts verified is RetrievedPayment {
    if (!verified || verified.status !== 'COMPLETE') {
      throw new ConflictException({
        message: 'Le paiement n\'est pas confirme par NotchPay.',
        errorCode: 'PAYMENT_NOT_CONFIRMED',
      });
    }
    if (
      verified.amount == null ||
      verified.amount !== payment.amountXaf ||
      verified.currency !== payment.currency
    ) {
      throw new BadRequestException({
        message: 'Le montant ou la devise du paiement ne correspond pas au checkout.',
        errorCode: 'PAYMENT_AMOUNT_MISMATCH',
      });
    }
    if (verified.reference && verified.reference !== payment.reference) {
      throw new BadRequestException({
        message: 'La reference du paiement ne correspond pas au checkout.',
        errorCode: 'PAYMENT_REFERENCE_MISMATCH',
      });
    }
    if (
      payment.providerTransactionId &&
      verified.providerTransactionId !== payment.providerTransactionId
    ) {
      throw new BadRequestException({
        message: 'La transaction NotchPay ne correspond pas au checkout.',
        errorCode: 'PAYMENT_REFERENCE_MISMATCH',
      });
    }
  }

  private paymentReturnUrl(): string | undefined {
    const publicUrl = process.env.APP_PUBLIC_URL?.trim();
    if (!publicUrl) return undefined;
    try {
      const returnUrl = new URL('/settings', publicUrl);
      returnUrl.searchParams.set('payment', 'return');
      return returnUrl.toString();
    } catch {
      throw new BadRequestException({
        message: 'APP_PUBLIC_URL est invalide.',
        errorCode: 'PAYMENT_CONFIGURATION_ERROR',
      });
    }
  }

  private isUniqueConstraintError(error: unknown): boolean {
    return (
      error != null &&
      typeof error === 'object' &&
      'code' in error &&
      (error as { code?: string }).code === 'P2002'
    );
  }
}
