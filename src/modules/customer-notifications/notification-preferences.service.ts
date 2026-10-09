import { Injectable } from '@nestjs/common';
import { CustomerNotificationEvent } from '@prisma/client';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { requireGarageId } from '../../shared/garage/garage-scope';
import { NOTIFICATION_CATALOG } from './customer-notification-catalog';

export type NotificationPreference = {
  eventType: CustomerNotificationEvent;
  enabled: boolean;
  defaultEnabled: boolean;
};

const EVENTS = Object.keys(NOTIFICATION_CATALOG) as CustomerNotificationEvent[];

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

  /** Tous les événements du catalogue, dans son ordre, avec leur valeur effective. */
  async list(garageId: string | null | undefined): Promise<NotificationPreference[]> {
    const rows = await this.prisma.garageNotificationSetting.findMany({
      where: { garageId: requireGarageId(garageId) },
      select: { eventType: true, enabled: true },
    });
    const overrides = new Map(rows.map((row) => [row.eventType, row.enabled]));
    return EVENTS.map((eventType) => {
      const defaultEnabled = NOTIFICATION_CATALOG[eventType].defaultEnabled;
      return { eventType, enabled: overrides.get(eventType) ?? defaultEnabled, defaultEnabled };
    });
  }

  /** N'écrit que les événements dont la valeur effective change (second appel identique = zéro écriture). */
  async update(
    garageId: string | null | undefined,
    changes: { eventType: CustomerNotificationEvent; enabled: boolean }[],
    userId: string | null | undefined,
  ): Promise<NotificationPreference[]> {
    const g = requireGarageId(garageId);
    const current = new Map((await this.list(g)).map((pref) => [pref.eventType, pref.enabled]));
    const desired = new Map(changes.map((change) => [change.eventType, change.enabled]));
    const writes = [...desired]
      .filter(([eventType, enabled]) => current.get(eventType) !== enabled)
      .map(([eventType, enabled]) =>
        this.prisma.garageNotificationSetting.upsert({
          where: { garageId_eventType: { garageId: g, eventType } },
          create: { garageId: g, eventType, enabled, updatedById: userId ?? null },
          update: { enabled, updatedById: userId ?? null },
          select: { id: true },
        }),
      );
    if (writes.length > 0) await this.prisma.$transaction(writes);
    return this.list(g);
  }
}
