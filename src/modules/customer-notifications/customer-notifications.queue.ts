import type { JobsOptions } from 'bullmq';
import { messagingJobOptions } from '../../workers/sms-job.options';

export const CUSTOMER_NOTIFICATIONS_QUEUE = 'customer-notifications';
export const DISPATCH_JOB = 'dispatch';

/** Seul l'identifiant voyage dans Redis : ni numéro, ni variable, ni jeton. */
export type DispatchJobData = { notificationId: string };

/** `jobId` déterministe : une seconde mise en file de la même notification est ignorée par BullMQ. */
export function dispatchJobOptions(notificationId: string): JobsOptions {
  return messagingJobOptions(`cn_${notificationId}`);
}
