import { createHash } from 'node:crypto';
import { Logger } from '@nestjs/common';
import { PermanentMessagingError } from '../messaging.errors';
import { detectCameroonOperator, isValidAlphanumericSenderId, maskPhone, toE164 } from '../shared/phone';
import type {
  SendSmsRequest,
  SendSmsResult,
  SenderValidation,
  SmsBalance,
  SmsDeliveryStatus,
  SmsProvider,
} from './sms-provider.interface';

export const SIMULATOR_PROVIDER_NAME = 'simulator';
const SIMULATED_ID_PREFIX = 'sim-';

/**
 * Fournisseur par défaut : aucun SMS ne quitte le serveur.
 *
 * - Déterministe : l'identifiant renvoyé dérive de la clé d'idempotence, donc
 *   un nouvel essai du même job renvoie le même `providerMessageId`.
 * - Aucune attente artificielle (l'ancien `mockSmsGateway` dormait 500 ms).
 * - Journal sans le corps du message et avec un numéro masqué.
 * - Un numéro inexploitable lève une erreur PERMANENTE, comme le ferait un
 *   vrai fournisseur.
 */
export class SimulatorSmsProvider implements SmsProvider {
  readonly name = SIMULATOR_PROVIDER_NAME;
  readonly simulated = true;
  private readonly logger = new Logger(SimulatorSmsProvider.name);

  async sendSms(request: SendSmsRequest): Promise<SendSmsResult> {
    const to = toE164(request.to);
    if (!to) {
      throw new PermanentMessagingError('INVALID_RECIPIENT', 'Numéro de destinataire invalide.', this.name);
    }
    if (request.senderId !== undefined && !isValidAlphanumericSenderId(request.senderId)) {
      throw new PermanentMessagingError('SENDER_REJECTED', "Nom d'expéditeur invalide.", this.name);
    }

    const operator = detectCameroonOperator(to);
    const providerMessageId = `${SIMULATED_ID_PREFIX}${createHash('sha256')
      .update(request.idempotencyKey)
      .digest('hex')
      .slice(0, 24)}`;

    this.logger.log(
      `SMS simulé (non envoyé) → ${maskPhone(to)} [${operator}], ${request.text.length} caractères, ref ${providerMessageId}`,
    );
    return { providerMessageId, status: 'SENT', operator };
  }

  async getDeliveryStatus(providerMessageId: string): Promise<SmsDeliveryStatus> {
    return providerMessageId.startsWith(SIMULATED_ID_PREFIX)
      ? { status: 'DELIVERED' }
      : { status: 'UNKNOWN' };
  }

  async getBalance(): Promise<SmsBalance> {
    return { smsCredits: null };
  }

  async validateSender(senderId: string): Promise<SenderValidation> {
    return isValidAlphanumericSenderId(senderId)
      ? { valid: true }
      : { valid: false, reason: '1 à 11 caractères alphanumériques, au moins une lettre.' };
  }
}
