import { Injectable, Logger } from '@nestjs/common';
import { renderWelcomeEmail, type WelcomeEmailInput } from './signup-welcome.email';

export type EmailSendResult = 'sent' | 'skipped' | 'failed';

const RESEND_ENDPOINT = 'https://api.resend.com/emails';
const SEND_TIMEOUT_MS = 10_000;

/**
 * Envoi des e-mails transactionnels d'inscription via l'API Resend.
 *
 * - Configuration 100 % par environnement : RESEND_API_KEY, SIGNUP_EMAIL_FROM
 *   (+ SIGNUP_EMAIL_REPLY_TO, APP_PUBLIC_URL ou APP_DOMAIN). Sans clé : no-op journalisé.
 * - Ne lève jamais : une inscription ne doit pas échouer à cause d'un e-mail.
 * - Idempotent : Idempotency-Key par tenant → Resend ignore un renvoi (retry, double appel).
 * - Le secret n'est jamais journalisé.
 */
@Injectable()
export class SignupEmailService {
  private readonly logger = new Logger(SignupEmailService.name);

  /** URL publique de l'app pour les liens et le logo, sans slash final. */
  static resolveAppUrl(env: NodeJS.ProcessEnv = process.env): string | null {
    const explicit = env.APP_PUBLIC_URL?.trim();
    if (explicit) return explicit.replace(/\/+$/, '');
    const domain = env.APP_DOMAIN?.trim();
    return domain ? `https://${domain.replace(/\/+$/, '')}` : null;
  }

  async sendWelcome(
    tenantId: string,
    input: Omit<WelcomeEmailInput, 'appUrl'>,
  ): Promise<EmailSendResult> {
    const apiKey = process.env.RESEND_API_KEY?.trim();
    const from = process.env.SIGNUP_EMAIL_FROM?.trim();
    if (!apiKey || !from) {
      this.logger.warn('E-mail de bienvenue non envoyé : RESEND_API_KEY ou SIGNUP_EMAIL_FROM absent.');
      return 'skipped';
    }

    const { subject, html, text } = renderWelcomeEmail({
      ...input,
      appUrl: SignupEmailService.resolveAppUrl(),
    });
    const replyTo = process.env.SIGNUP_EMAIL_REPLY_TO?.trim();

    try {
      const response = await fetch(RESEND_ENDPOINT, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'Idempotency-Key': `atelier-signup-welcome/${tenantId}`,
        },
        body: JSON.stringify({
          from,
          to: [input.adminEmail],
          ...(replyTo ? { reply_to: replyTo } : {}),
          subject,
          html,
          text,
          tags: [{ name: 'category', value: 'signup_welcome' }],
        }),
        signal: AbortSignal.timeout(SEND_TIMEOUT_MS),
      });

      if (!response.ok) {
        this.logger.warn(`E-mail de bienvenue non envoyé (tenant ${tenantId}) : Resend HTTP ${response.status}`);
        return 'failed';
      }
      this.logger.log(`E-mail de bienvenue envoyé (tenant ${tenantId})`);
      return 'sent';
    } catch (error) {
      this.logger.warn(
        `E-mail de bienvenue non envoyé (tenant ${tenantId}) : ${error instanceof Error ? error.message : String(error)}`,
      );
      return 'failed';
    }
  }
}
