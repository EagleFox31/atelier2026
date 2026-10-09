import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import type { WhatsAppWebhookEvent, WhatsAppWebhookEventOutcome } from '@prisma/client';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { CustomerConsentService } from './customer-consent.service';
import { WhatsAppSenderResolver } from './whatsapp-sender.resolver';

/** Borne de sécurité : un même numéro n'est jamais rattaché à plus de clients que ça. */
export const MAX_OPT_OUT_CUSTOMERS = 50;

export const OPT_OUT_NOTE_PREFIX = 'Message « STOP » reçu sur WhatsApp';

/**
 * Désabonnement « STOP » reçu sur WhatsApp : retire le consentement WhatsApp des clients
 * à qui ce compte émetteur a réellement écrit à ce numéro.
 *
 * Garanties (ne pas régresser) :
 * - le garage vient des notifications envoyées (compte émetteur + numéro destinataire), jamais
 *   de la charge Meta : un numéro jamais contacté depuis ce compte ne touche aucun consentement ;
 * - seul un consentement GRANTED au même numéro est retiré ; preuve écrite dans le journal du
 *   consentement (source CUSTOMER_MESSAGE, sans auteur) ; idempotent ;
 * - aucune réponse automatique au client, aucun contenu de message conservé ;
 * - journaux : identifiants internes et compteurs seulement, jamais le numéro.
 */
@Injectable()
export class WhatsAppOptOutService {
  private readonly logger = new Logger(WhatsAppOptOutService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly senders: WhatsAppSenderResolver,
    private readonly consents: CustomerConsentService,
  ) {}

  async handle(event: WhatsAppWebhookEvent): Promise<WhatsAppWebhookEventOutcome> {
    const phone = event.senderE164;
    if (!phone) return 'IGNORED';

    const contacted = await this.prisma.customerNotification.findMany({
      where: {
        provider: event.provider,
        senderAccountRef: { in: this.senders.accountRefsFor(event.provider, event.phoneNumberId) },
        recipientE164: phone,
        providerMessageId: { not: null },
        customerId: { not: null },
      },
      select: { garageId: true, customerId: true },
      distinct: ['garageId', 'customerId'],
      take: MAX_OPT_OUT_CUSTOMERS,
    });
    if (contacted.length === 0) {
      this.logger.warn(`« STOP » WhatsApp ${event.id} : aucun client contacté à ce numéro depuis ce compte.`);
      return 'UNMATCHED';
    }

    const granted = await this.prisma.customerChannelConsent.findMany({
      where: {
        channel: 'WHATSAPP',
        status: 'GRANTED',
        phoneE164: phone,
        OR: contacted.map(({ garageId, customerId }) => ({ garageId, customerId: customerId as string })),
      },
      select: { garageId: true, customerId: true },
    });

    let revoked = 0;
    for (const { garageId, customerId } of granted) {
      try {
        const result = await this.consents.record(
          customerId,
          'WHATSAPP',
          { status: 'REVOKED', source: 'CUSTOMER_MESSAGE', phone, note: `${OPT_OUT_NOTE_PREFIX} (${event.providerMessageId}).` },
          garageId,
          null,
        );
        if (result.changed) revoked += 1;
      } catch (error) {
        // Client supprimé entre-temps : rien à retirer.
        if (!(error instanceof NotFoundException)) throw error;
      }
    }
    this.logger.log(`« STOP » WhatsApp ${event.id} : ${revoked} consentement(s) retiré(s) sur ${contacted.length} client(s) contacté(s).`);
    return revoked > 0 ? 'APPLIED' : 'NO_CHANGE';
  }
}
