import type { JobsOptions } from 'bullmq';

const DAY_SECONDS = 24 * 60 * 60;

/**
 * Relances bornées d'un envoi SMS en échec TEMPORAIRE (fournisseur indisponible) :
 * 3 tentatives, attente exponentielle 1 min puis 2 min. Les refus définitifs
 * (`UnrecoverableError` dans `SmsProcessor`) ne sont jamais relancés.
 * Source unique pour tous les producteurs de la file `sms-notifications`.
 */
export const SMS_RETRY_OPTIONS = {
  attempts: 3,
  backoff: { type: 'exponential', delay: 60_000 },
} as const satisfies JobsOptions;

/** Rétention par défaut : 7 j, assez pour diagnostiquer et pour dédoublonner par `jobId`. */
export const SMS_DEFAULT_RETENTION = {
  removeOnComplete: { age: 7 * DAY_SECONDS },
  removeOnFail: { age: 7 * DAY_SECONDS },
} as const satisfies JobsOptions;

/**
 * Options d'un job SMS : relances bornées + rétention + `jobId` déterministe.
 * Tant que le job est conservé, une seconde mise en file avec le même `jobId`
 * est ignorée par BullMQ : un double enqueue ne peut pas envoyer deux fois.
 * BullMQ interdit « : » dans un jobId personnalisé → échec immédiat (fail-fast).
 */
export function smsJobOptions(
  jobId: string,
  retention: Pick<JobsOptions, 'removeOnComplete' | 'removeOnFail'> = SMS_DEFAULT_RETENTION,
): JobsOptions {
  if (!jobId.trim() || jobId.includes(':')) {
    throw new Error(`jobId SMS invalide (vide ou contenant « : ») : ${jobId}`);
  }
  return { ...SMS_RETRY_OPTIONS, backoff: { ...SMS_RETRY_OPTIONS.backoff }, ...retention, jobId };
}
