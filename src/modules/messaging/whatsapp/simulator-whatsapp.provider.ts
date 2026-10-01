import { createHash } from 'node:crypto';
import { Logger } from '@nestjs/common';
import { PermanentMessagingError } from '../messaging.errors';
import { maskPhone, toE164 } from '../shared/phone';
import type {
  SendWhatsAppMessageRequest,
  SendWhatsAppResult,
  SendWhatsAppTemplateRequest,
  WhatsAppProvider,
} from './whatsapp-provider.interface';

/** Simulateur WhatsApp : rien n'est envoyé, identifiant déterministe, journal masqué. */
export class SimulatorWhatsAppProvider implements WhatsAppProvider {
  readonly name = 'simulator';
  private readonly logger = new Logger(SimulatorWhatsAppProvider.name);

  async sendWhatsAppMessage(request: SendWhatsAppMessageRequest): Promise<SendWhatsAppResult> {
    return this.simulate(request.to, request.idempotencyKey, `${request.text.length} caractères`);
  }

  async sendTemplate(request: SendWhatsAppTemplateRequest): Promise<SendWhatsAppResult> {
    return this.simulate(request.to, request.idempotencyKey, `modèle ${request.templateName} (${request.language})`);
  }

  private simulate(rawTo: string, idempotencyKey: string, summary: string): SendWhatsAppResult {
    const to = toE164(rawTo);
    if (!to) {
      throw new PermanentMessagingError('INVALID_RECIPIENT', 'Numéro de destinataire invalide.', this.name);
    }
    const providerMessageId = `sim-wa-${createHash('sha256').update(idempotencyKey).digest('hex').slice(0, 24)}`;
    this.logger.log(`WhatsApp simulé (non envoyé) → ${maskPhone(to)}, ${summary}, ref ${providerMessageId}`);
    return { providerMessageId, status: 'SENT' };
  }
}
