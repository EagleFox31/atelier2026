import type { CustomerNotificationsMode } from './customer-notifications.config';

/** Raisons d'abandon, dans l'ordre d'évaluation (voir docs/architecture/notifications-client.md). */
export type SkipReason =
  | 'MODE_OFF'
  | 'DISABLED_BY_GARAGE'
  | 'NOT_ENTITLED'
  | 'STALE'
  | 'NO_CONSENT'
  | 'TEMPLATE_NOT_APPROVED'
  | 'SANDBOX_RECIPIENT_NOT_ALLOWED'
  | 'QUOTA_EXCEEDED';

export type DispatchInput = {
  mode: CustomerNotificationsMode;
  eventEnabled: boolean;
  entitled: boolean;
  stale: boolean;
  /** Numéro E.164 du consentement WhatsApp accordé, sinon `null`. */
  consentPhone: string | null;
  templateName: string;
  /** Langues candidates, par ordre de préférence. */
  languages: readonly string[];
  isTemplateApproved: (name: string, language: string) => boolean;
  testRecipients: ReadonlySet<string>;
  sentThisMonth: number;
  monthlyCap: number;
};

export type DispatchDecision =
  | { action: 'SKIP'; reason: SkipReason }
  | { action: 'SEND'; channel: 'WHATSAPP'; to: string; templateName: string; language: string };

/** Décision d'envoi : fonction pure, la première règle qui échoue l'emporte. */
export function resolveDispatch(input: DispatchInput): DispatchDecision {
  if (input.mode === 'off') return skip('MODE_OFF');
  if (!input.eventEnabled) return skip('DISABLED_BY_GARAGE');
  if (!input.entitled) return skip('NOT_ENTITLED');
  if (input.stale) return skip('STALE');
  if (!input.consentPhone) return skip('NO_CONSENT');

  const language = input.languages.find((lang) => input.isTemplateApproved(input.templateName, lang));
  if (!language) return skip('TEMPLATE_NOT_APPROVED');

  if (input.mode === 'sandbox' && !input.testRecipients.has(input.consentPhone)) {
    return skip('SANDBOX_RECIPIENT_NOT_ALLOWED');
  }
  if (input.sentThisMonth >= input.monthlyCap) return skip('QUOTA_EXCEEDED');

  return { action: 'SEND', channel: 'WHATSAPP', to: input.consentPhone, templateName: input.templateName, language };
}

function skip(reason: SkipReason): DispatchDecision {
  return { action: 'SKIP', reason };
}
