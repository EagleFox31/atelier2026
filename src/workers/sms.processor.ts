
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { PrismaService } from '../shared/prisma/prisma.service';
import { SubscriptionService } from '../modules/subscription/subscription.service';

@Processor('sms-notifications')
export class SmsProcessor extends WorkerHost {
  private readonly logger = new Logger(SmsProcessor.name);

  constructor(
    private prisma: PrismaService,
    private subscriptions: SubscriptionService,
  ) {
    super();
  }

  async process(job: Job<any, any, string>): Promise<any> {
    const { phone, message, customerId, lang, notificationId, serviceOrderId } = job.data;
    
    this.logger.log(`Traitement SMS pour ${phone} (${lang})`);

    const tenantId = await this.resolveTenantId({
      notificationId,
      serviceOrderId,
      customerId,
    });
    if (tenantId) {
      try {
        await this.subscriptions.assertSmsEntitled(tenantId);
      } catch {
        const message = 'SMS non envoyé : abonnement Pro ou Business actif requis.';
        this.logger.warn(message);
        if (notificationId) {
          await this.prisma.sMSNotification.update({
            where: { id: notificationId },
            data: {
              status: 'FAILED',
              errorMessage: message,
            },
          }).catch(() => undefined);
        }
        return { skipped: true, reason: 'SMS_SUBSCRIPTION_REQUIRED' };
      }
    }

    // 1. Détection Opérateur (Point 10 / Localisation)
    const operator = this.detectOperator(phone);
    
    try {
      // Simulation d'envoi via Gateway Orange/MTN
      const success = await this.mockSmsGateway(phone, message, operator);

      if (success) {
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
              phoneTo: phone,
              messageBody: message,
              customerId: customerId,
              lang,
              ...(serviceOrderId ? { serviceOrderId } : {}),
              ...sentData,
            },
          });
        }
      } else {
        throw new Error('Gateway timeout');
      }
    } catch (error) {
      this.logger.error(`Échec envoi SMS à ${phone}`, error);
      // BullMQ gérera le retry automatiquement si configuré
      throw error;
    }
  }

  private async resolveTenantId(input: {
    notificationId?: string;
    serviceOrderId?: string;
    customerId?: string;
  }): Promise<string | null> {
    if (input.notificationId) {
      const row = await this.prisma.sMSNotification.findUnique({
        where: { id: input.notificationId },
        select: { garage: { select: { tenantId: true } } },
      });
      if (row?.garage?.tenantId) return row.garage.tenantId;
    }

    if (input.serviceOrderId) {
      const row = await this.prisma.serviceOrder.findUnique({
        where: { id: input.serviceOrderId },
        select: { garageId: true },
      });
      if (row?.garageId) {
        const garage = await this.prisma.garage.findUnique({
          where: { id: row.garageId },
          select: { tenantId: true },
        });
        if (garage?.tenantId) return garage.tenantId;
      }
    }

    if (input.customerId) {
      const row = await this.prisma.customer.findUnique({
        where: { id: input.customerId },
        select: { garageId: true },
      });
      if (row?.garageId) {
        const garage = await this.prisma.garage.findUnique({
          where: { id: row.garageId },
          select: { tenantId: true },
        });
        if (garage?.tenantId) return garage.tenantId;
      }
    }

    return null;
  }

  private detectOperator(phone: string): string {
    const p = phone.replace('+237', '').replace(/\s/g, '');
    if (p.startsWith('69') || p.startsWith('655')) return 'ORANGE_CM';
    if (p.startsWith('67') || p.startsWith('68') || p.startsWith('650')) return 'MTN_CM';
    if (p.startsWith('2')) return 'CAMTEL';
    return 'UNKNOWN';
  }

  private async mockSmsGateway(phone: string, message: string, operator: string): Promise<boolean> {
    // Simule un délai réseau
    await new Promise(resolve => setTimeout(resolve, 500));
    return true;
  }
}
