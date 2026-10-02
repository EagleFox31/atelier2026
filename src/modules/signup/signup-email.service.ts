import { Injectable, Optional } from '@nestjs/common';
import {
  TransactionalEmailService,
  type EmailSendResult,
} from '../../shared/email/transactional-email.service';
import { renderWelcomeEmail, type WelcomeEmailInput } from './signup-welcome.email';

export type { EmailSendResult };

/**
 * E-mail de bienvenue après inscription. Le transport (Resend, timeout, no-op sans clé,
 * jamais d'exception, secret jamais journalisé) est mutualisé dans TransactionalEmailService.
 *
 * Configuration : RESEND_API_KEY, SIGNUP_EMAIL_FROM (+ SIGNUP_EMAIL_REPLY_TO, APP_PUBLIC_URL ou APP_DOMAIN).
 * Idempotent : Idempotency-Key par tenant → Resend ignore un renvoi (retry, double appel).
 */
@Injectable()
export class SignupEmailService {
  constructor(
    @Optional() private readonly transport: TransactionalEmailService = new TransactionalEmailService(),
  ) {}

  /** URL publique de l'app pour les liens et le logo, sans slash final. */
  static resolveAppUrl(env: NodeJS.ProcessEnv = process.env): string | null {
    return TransactionalEmailService.resolveAppUrl(env);
  }

  async sendWelcome(
    tenantId: string,
    input: Omit<WelcomeEmailInput, 'appUrl'>,
  ): Promise<EmailSendResult> {
    const { subject, html, text } = renderWelcomeEmail({
      ...input,
      appUrl: SignupEmailService.resolveAppUrl(),
    });
    return this.transport.send({
      to: input.adminEmail,
      subject,
      html,
      text,
      idempotencyKey: `atelier-signup-welcome/${tenantId}`,
      category: 'signup_welcome',
      logLabel: `E-mail de bienvenue (tenant ${tenantId})`,
    });
  }
}
