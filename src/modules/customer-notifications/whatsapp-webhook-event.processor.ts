import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { WHATSAPP_WEBHOOK_EVENTS_QUEUE, type ApplyEventJobData } from './whatsapp-webhook.queue';
import { StatusNotYetCorrelatedError, WhatsAppStatusService, type ApplyEventResult } from './whatsapp-status.service';

/**
 * Worker de la file `whatsapp-webhook-events`. Un accusé pas encore rattachable est relancé
 * (relances bornées de `messagingJobOptions`) ; au-delà, le balayeur reprend l'événement.
 */
@Processor(WHATSAPP_WEBHOOK_EVENTS_QUEUE)
export class WhatsAppWebhookEventProcessor extends WorkerHost {
  private readonly logger = new Logger(WhatsAppWebhookEventProcessor.name);

  constructor(private readonly statuses: WhatsAppStatusService) {
    super();
  }

  async process(job: Job<ApplyEventJobData, unknown, string>): Promise<ApplyEventResult> {
    try {
      return await this.statuses.apply(job.data.eventId);
    } catch (error) {
      if (!(error instanceof StatusNotYetCorrelatedError)) {
        this.logger.error(
          `Accusé WhatsApp ${job.data.eventId} non appliqué`,
          error instanceof Error ? error.stack : String(error),
        );
      }
      throw error;
    }
  }
}
