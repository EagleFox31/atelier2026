import { Injectable, Logger } from '@nestjs/common';

export type EmailSendResult = 'sent' | 'skipped' | 'failed';

export type TransactionalEmail = {
  to: string;
  subject: string;
  html: string;
  text: string;
  /** Clé d'idempotence Resend : un renvoi (retry, double appel) avec la même clé est ignoré. */
  idempotencyKey: string;
  /** Tag Resend (catégorie de l'e-mail). */
  category: string;
  /** Libellé pour les journaux (jamais de secret, jamais de jeton). */
  logLabel: string;
  /** Expéditeur ; par défaut SIGNUP_EMAIL_FROM. */
  from?: string;
  /** Adresse de réponse ; par défaut SIGNUP_EMAIL_REPLY_TO. */
  replyTo?: string;
};

const RESEND_ENDPOINT = 'https://api.resend.com/emails';
const SEND_TIMEOUT_MS = 10_000;

/**
 * Transport partagé des e-mails transactionnels (bienvenue, invitations…) via l'API Resend.
 *
 * - Configuration 100 % par environnement : RESEND_API_KEY, SIGNUP_EMAIL_FROM (expéditeur
 *   par défaut), SIGNUP_EMAIL_REPLY_TO. Sans clé ou sans expéditeur : no-op journalisé (« skipped »).
 * - Ne lève jamais : un parcours métier ne doit pas échouer à cause d'un e-mail.
 * - Idempotent : Idempotency-Key fourni par l'appelant.
 * - Ni la clé API ni le contenu (qui peut contenir un lien secret) ne sont journalisés.
 */
@Injectable()
export class TransactionalEmailService {
  private readonly logger = new Logger(TransactionalEmailService.name);

  /** URL publique de l'app pour les liens et le logo, sans slash final (APP_PUBLIC_URL, sinon https://APP_DOMAIN). */
  static resolveAppUrl(env: NodeJS.ProcessEnv = process.env): string | null {
    const explicit = env.APP_PUBLIC_URL?.trim();
    if (explicit) return explicit.replace(/\/+$/, '');
    const domain = env.APP_DOMAIN?.trim();
    return domain ? `https://${domain.replace(/\/+$/, '')}` : null;
  }

  async send(email: TransactionalEmail): Promise<EmailSendResult> {
    const apiKey = process.env.RESEND_API_KEY?.trim();
    const from = email.from?.trim() || process.env.SIGNUP_EMAIL_FROM?.trim();
    if (!apiKey || !from) {
      this.logger.warn(`${email.logLabel} non envoyé : RESEND_API_KEY ou expéditeur absent.`);
      return 'skipped';
    }
    const replyTo = email.replyTo?.trim() || process.env.SIGNUP_EMAIL_REPLY_TO?.trim();

    try {
      const response = await fetch(RESEND_ENDPOINT, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'Idempotency-Key': email.idempotencyKey,
        },
        body: JSON.stringify({
          from,
          to: [email.to],
          ...(replyTo ? { reply_to: replyTo } : {}),
          subject: email.subject,
          html: email.html,
          text: email.text,
          tags: [{ name: 'category', value: email.category }],
        }),
        signal: AbortSignal.timeout(SEND_TIMEOUT_MS),
      });

      if (!response.ok) {
        this.logger.warn(`${email.logLabel} non envoyé : Resend HTTP ${response.status}`);
        return 'failed';
      }
      this.logger.log(`${email.logLabel} envoyé`);
      return 'sent';
    } catch (error) {
      this.logger.warn(
        `${email.logLabel} non envoyé : ${error instanceof Error ? error.message : String(error)}`,
      );
      return 'failed';
    }
  }
}
