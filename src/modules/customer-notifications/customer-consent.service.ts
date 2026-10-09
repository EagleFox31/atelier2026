import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { ConsentSource, ConsentStatus, NotificationChannel } from '@prisma/client';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { assertCustomerInGarage, requireGarageId } from '../../shared/garage/garage-scope';
import { toE164 } from '../messaging';
import { WHATSAPP_CONSENT_TEXT } from './consent-text';

export type RecordConsentInput = {
  status: ConsentStatus;
  source: ConsentSource;
  phone?: string;
  note?: string;
};

const EVENT_SELECT = {
  id: true,
  action: true,
  phoneE164: true,
  source: true,
  consentTextVersion: true,
  note: true,
  occurredAt: true,
  recordedBy: { select: { firstName: true, lastName: true } },
} as const;

const CONSENT_SELECT = {
  channel: true,
  status: true,
  phoneE164: true,
  grantedAt: true,
  revokedAt: true,
  updatedAt: true,
  events: { select: EVENT_SELECT, orderBy: { occurredAt: 'desc' as const }, take: 20 },
} as const;

/**
 * Consentement d'un client par canal : état courant + journal en ajout seul.
 * Le moteur n'envoie qu'au numéro d'un consentement `GRANTED` (resolveDispatch).
 */
@Injectable()
export class CustomerConsentService {
  constructor(private readonly prisma: PrismaService) {}

  async list(customerId: string, garageId: string | null | undefined) {
    await assertCustomerInGarage(this.prisma, customerId, garageId);
    const consents = await this.prisma.customerChannelConsent.findMany({
      where: { customerId, garageId: requireGarageId(garageId) },
      select: CONSENT_SELECT,
    });
    return { consentText: WHATSAPP_CONSENT_TEXT, consents };
  }

  /**
   * Idempotent : même statut et même numéro que l'état courant = aucune écriture.
   * Sinon, état et événement de preuve sont écrits dans une seule requête (écriture imbriquée).
   */
  async record(
    customerId: string,
    channel: NotificationChannel,
    input: RecordConsentInput,
    garageId: string | null | undefined,
    userId: string | null | undefined,
  ) {
    const g = requireGarageId(garageId);
    const customer = await this.prisma.customer.findFirst({
      where: { id: customerId, garageId: g, deletedAt: null },
      select: { phonePrimary: true, channelConsents: { where: { channel }, select: { status: true, phoneE164: true } } },
    });
    // Même 404 que assertCustomerInGarage : masque l'IDOR.
    if (!customer) throw new NotFoundException('Client introuvable');
    const current = customer.channelConsents[0] ?? null;
    const rawPhone = input.phone?.trim() || (input.status === 'REVOKED' ? current?.phoneE164 : null) || customer.phonePrimary;
    const phoneE164 = toE164(rawPhone);
    if (!phoneE164) {
      throw new BadRequestException({
        message: 'Numéro de téléphone invalide pour WhatsApp',
        errorCode: 'CONSENT_PHONE_INVALID',
      });
    }

    if (current && current.status === input.status && current.phoneE164 === phoneE164) {
      return { changed: false, consent: await this.findOne(customerId, channel) };
    }

    const now = new Date();
    const state = {
      status: input.status,
      phoneE164,
      ...(input.status === 'GRANTED' ? { grantedAt: now, revokedAt: null } : { revokedAt: now }),
    };
    const event = {
      create: {
        action: input.status,
        phoneE164,
        source: input.source,
        consentTextVersion: WHATSAPP_CONSENT_TEXT.version,
        note: input.note?.trim() || null,
        recordedById: userId ?? null,
        occurredAt: now,
      },
    };
    const consent = await this.prisma.customerChannelConsent.upsert({
      where: { customerId_channel: { customerId, channel } },
      create: { garageId: g, customerId, channel, ...state, events: event },
      update: { ...state, events: event },
      select: CONSENT_SELECT,
    });
    return { changed: true, consent };
  }

  private findOne(customerId: string, channel: NotificationChannel) {
    return this.prisma.customerChannelConsent.findUnique({
      where: { customerId_channel: { customerId, channel } },
      select: CONSENT_SELECT,
    });
  }
}
