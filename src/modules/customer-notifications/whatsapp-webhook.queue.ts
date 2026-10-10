import type { JobsOptions } from 'bullmq';
import { messagingJobOptions } from '../../workers/sms-job.options';

export const WHATSAPP_WEBHOOK_EVENTS_QUEUE = 'whatsapp-webhook-events';
export const APPLY_EVENT_JOB = 'apply';

/** Seul l'identifiant de l'événement voyage dans Redis. */
export type ApplyEventJobData = { eventId: string };

/** `jobId` déterministe : un même événement n'est mis en file qu'une fois. */
export function applyEventJobOptions(eventId: string): JobsOptions {
  return messagingJobOptions(`wwe_${eventId}`);
}
