import { Injectable } from '@nestjs/common';
import type { CustomerNotificationEvent } from '@prisma/client';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { NOTIFICATION_CATALOG } from './customer-notification-catalog';

/** Activation d'un événement pour un garage : ligne de surcharge, sinon défaut du catalogue. */
@Injectable()
export class NotificationPreferencesService {
  constructor(private readonly prisma: PrismaService) {}

  async isEnabled(garageId: string, eventType: CustomerNotificationEvent): Promise<boolean> {
    const setting = await this.prisma.garageNotificationSetting.findUnique({
      where: { garageId_eventType: { garageId, eventType } },
      select: { enabled: true },
    });
    return setting?.enabled ?? NOTIFICATION_CATALOG[eventType].defaultEnabled;
  }
}
