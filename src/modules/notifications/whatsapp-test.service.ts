import {
  BadGatewayException,
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { MessagingError, WHATSAPP_PROVIDER, type WhatsAppProvider } from '../messaging';
import { maskPhone, toE164 } from '../messaging/shared/phone';
import type { SendWhatsAppTestDto } from './dto/notifications.dto';

export const WHATSAPP_TEST_DEFAULT_TEMPLATE = 'hello_world';
export const WHATSAPP_TEST_DEFAULT_LANGUAGE = 'en_US';

export function parseTestRecipients(raw: string | undefined): Set<string> {
  return new Set(
    (raw ?? '')
      .split(',')
      .map((value) => toE164(value))
      .filter((value): value is string => value !== null),
  );
}

/**
 * Envoi de contrôle d'un modèle WhatsApp depuis le backend, avant tout raccordement
 * métier. Destinataires limités à `WHATSAPP_TEST_RECIPIENTS` : le compte d'envoi
 * appartient à la plateforme, pas à un garage.
 */
@Injectable()
export class WhatsAppTestService {
  private readonly logger = new Logger(WhatsAppTestService.name);

  constructor(@Inject(WHATSAPP_PROVIDER) private readonly provider: WhatsAppProvider) {}

  async sendTest(input: SendWhatsAppTestDto, env: NodeJS.ProcessEnv = process.env) {
    const to = toE164(input.to);
    if (!to) {
      throw new BadRequestException({
        message: 'Numéro de destinataire invalide.',
        errorCode: 'WHATSAPP_INVALID_RECIPIENT',
      });
    }
    if (!parseTestRecipients(env.WHATSAPP_TEST_RECIPIENTS).has(to)) {
      throw new ForbiddenException({
        message: "Ce numéro n'est pas autorisé pour l'envoi de test (WHATSAPP_TEST_RECIPIENTS).",
        errorCode: 'WHATSAPP_TEST_RECIPIENT_NOT_ALLOWED',
      });
    }

    const templateName = input.templateName ?? WHATSAPP_TEST_DEFAULT_TEMPLATE;
    const language = input.language ?? WHATSAPP_TEST_DEFAULT_LANGUAGE;
    try {
      const result = await this.provider.sendTemplate({
        to,
        templateName,
        language,
        variables: input.variables ?? [],
        idempotencyKey: `whatsapp-test:${randomUUID()}`,
      });
      this.logger.log(
        `Test WhatsApp accepté par ${this.provider.name} (${templateName}/${language} → ${maskPhone(to)}) : ${result.providerMessageId}`,
      );
      return {
        provider: this.provider.name,
        to: maskPhone(to),
        templateName,
        language,
        providerMessageId: result.providerMessageId,
        // Accepté par le fournisseur, pas encore livré : la livraison viendra des webhooks.
        status: result.status,
      };
    } catch (error) {
      if (!(error instanceof MessagingError)) throw error;
      this.logger.warn(
        `Test WhatsApp refusé par ${error.provider} (${error.code}, ${maskPhone(to)}) : ${error.message}`,
      );
      throw new BadGatewayException({
        message: error.message,
        errorCode: 'WHATSAPP_SEND_FAILED',
        providerErrorCode: error.code,
        permanent: error.permanent,
      });
    }
  }
}
