
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { ForbiddenException, Logger } from '@nestjs/common';
import { Job, UnrecoverableError } from 'bullmq';
import { SubscriptionService } from '../modules/subscription/subscription.service';
import { PrismaService } from '../shared/prisma/prisma.service';

export type SmsJobData = {
  tenantId?: string;
  garageId?: string;
  phone: string;
  message: string;
  customerId?: string;
  lang?: string;
  notificationId?: string;
  serviceOrderId?: string;
  invoiceId?: string;
  invoiceReminder?: 1 | 2;
};

@Processor('sms-notifications')
export class SmsProcessor extends WorkerHost {
  private readonly logger = new Logger(SmsProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly subscriptions: SubscriptionService,
  ) {
    super();
  }

  async process(job: Job<SmsJobData, unknown, string>): Promise<unknown> {
    const {
      phone,
      message,
      customerId,
      lang = 'fr',
      notificationId,
      serviceOrderId,
      garageId,
      invoiceId,
      invoiceReminder,
    } = job.data;

    this.logger.log(`Traitement SMS pour ${phone} (${lang})`);

    const tenantId = await this.resolveTenantId(job.data);
    if (!tenantId) {
      const reason = 'SMS non envoyé : contexte tenant introuvable.';
      await this.markNotificationFailed(notificationId, reason);
      throw new UnrecoverableError(reason);
    }

    try {
      await this.subscriptions.assertSmsEntitled(tenantId);
    } catch (error) {
      if (error instanceof ForbiddenException) {
        const reason = 'SMS non envoyé : abonnement Pro ou Business actif requis.';
        await this.markNotificationFailed(notificationId, reason);
        throw new UnrecoverableError(reason);
      }
      throw error;
    }

    const operator = this.detectOperator(phone);

    try {
      const success = await this.mockSmsGateway(phone, message, operator);
      if (!success) throw new Error('Gateway timeout');

      const sentData = {
        operator,
        status: 'SENT' as const,
        sentAt: new Date(),
        templateCode: job.name,
      };

      if (notificationId) {
        await this.prisma.sMSNotification.update({
          where: { id: notificationId },
          data: {
            ...sentData,
            ...(serviceOrderId ? { serviceOrderId } : {}),
          },
        });
      } else {
        await this.prisma.sMSNotification.create({
          data: {
            ...(garageId ? { garageId } : {}),
            phoneTo: phone,
            messageBody: message,
            customerId,
            lang,
            ...(serviceOrderId ? { serviceOrderId } : {}),
            ...sentData,
          },
        });
      }

      if (invoiceId && invoiceReminder) {
        await this.prisma.invoice.update({
          where: { id: invoiceId },
          data: invoiceReminder === 1
            ? { reminder1SentAt: new Date() }
            : { reminder2SentAt: new Date() },
        });
      }

      return { sent: true };
    } catch (error) {
      this.logger.error(`Échec envoi SMS à ${phone}`, error);
      throw error;
    }
  }

  private async resolveTenantId(data: SmsJobData): Promise<string | null> {
    if (data.tenantId?.trim()) return data.tenantId;

    if (data.notificationId) {
      const row = await this.prisma.sMSNotification.findUnique({
        where: { id: data.notificationId },
        select: { garage: { select: { tenantId: true } } },
      });
      if (row?.garage?.tenantId) return row.garage.tenantId;
    }

    if (data.garageId) return this.resolveGarageTenantId(data.garageId);

    if (data.serviceOrderId) {
      const row = await this.prisma.serviceOrder.findUnique({
        where: { id: data.serviceOrderId },
        select: { garageId: true },
      });
      if (row?.garageId) return this.resolveGarageTenantId(row.garageId);
    }

    if (data.customerId) {
      const row = await this.prisma.customer.findUnique({
        where: { id: data.customerId },
        select: { garageId: true },
      });
      if (row?.garageId) return this.resolveGarageTenantId(row.garageId);
    }

    return null;
  }

  private async resolveGarageTenantId(garageId: string): Promise<string | null> {
    const garage = await this.prisma.garage.findUnique({
      where: { id: garageId },
      select: { tenantId: true },
    });
    return garage?.tenantId ?? null;
  }

  private async markNotificationFailed(
    notificationId: string | undefined,
    reason: string,
  ): Promise<void> {
    if (!notificationId) return;
    await this.prisma.sMSNotification.update({
      where: { id: notificationId },
      data: { status: 'FAILED', errorMessage: reason },
    }).catch((error: unknown) => {
      this.logger.error(`Impossible de marquer le SMS ${notificationId} en échec`, error);
    });
  }

  private detectOperator(phone: string): string {
    const normalized = phone.replace('+237', '').replace(/\s/g, '');
    if (normalized.startsWith('69') || normalized.startsWith('655')) return 'ORANGE_CM';
    if (normalized.startsWith('67') || normalized.startsWith('68') || normalized.startsWith('650')) return 'MTN_CM';
    if (normalized.startsWith('2')) return 'CAMTEL';
    return 'UNKNOWN';
  }

  private async mockSmsGateway(
    _phone: string,
    _message: string,
    _operator: string,
  ): Promise<boolean> {
    await new Promise((resolve) => setTimeout(resolve, 500));
    return true;
  }
}
