import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { MessagingModule } from '../messaging';
import { SubscriptionModule } from '../subscription/subscription.module';
import { CustomerConsentService } from './customer-consent.service';
import { CustomerNotificationEmitter } from './customer-notification.emitter';
import { CustomerNotificationHistoryService } from './customer-notification-history.service';
import { CustomerNotificationProcessor } from './customer-notification.processor';
import { CustomerNotificationSweeper } from './customer-notification.sweeper';
import { CUSTOMER_NOTIFICATIONS_CONFIG, loadCustomerNotificationsConfig } from './customer-notifications.config';
import {
  CustomerNotificationsAdminController,
  CustomerNotificationsController,
  NotificationSettingsController,
} from './customer-notifications.controller';
import { CustomerNotificationsHealthService } from './customer-notifications-health.service';
import { CUSTOMER_NOTIFICATIONS_QUEUE } from './customer-notifications.queue';
import { NotificationPreferencesService } from './notification-preferences.service';
import { NotificationStalenessService } from './notification-staleness.service';
import { ReminderSchedulerService } from './reminder-scheduler.service';
import { WhatsAppOptOutService } from './whatsapp-opt-out.service';
import { WhatsAppSenderResolver } from './whatsapp-sender.resolver';
import { WhatsAppStatusService } from './whatsapp-status.service';
import { WhatsAppWebhookController } from './whatsapp-webhook.controller';
import { WhatsAppWebhookEventProcessor } from './whatsapp-webhook-event.processor';
import { WHATSAPP_WEBHOOK_EVENTS_QUEUE } from './whatsapp-webhook.queue';
import { WhatsAppWebhookService } from './whatsapp-webhook.service';
import { WhatsAppWebhookSweeper } from './whatsapp-webhook.sweeper';

/**
 * Notifications client (WhatsApp d'abord) — voir docs/architecture/notifications-client.md.
 * Les services métier n'importent que `CustomerNotificationEmitter`.
 * Configuration lue au démarrage : invalide = l'API refuse de démarrer.
 */
@Module({
  imports: [
    BullModule.registerQueue({ name: CUSTOMER_NOTIFICATIONS_QUEUE }, { name: WHATSAPP_WEBHOOK_EVENTS_QUEUE }),
    MessagingModule,
    SubscriptionModule,
  ],
  controllers: [
    CustomerNotificationsController,
    NotificationSettingsController,
    CustomerNotificationsAdminController,
    WhatsAppWebhookController,
  ],
  providers: [
    { provide: CUSTOMER_NOTIFICATIONS_CONFIG, useFactory: () => loadCustomerNotificationsConfig() },
    CustomerConsentService,
    CustomerNotificationEmitter,
    CustomerNotificationHistoryService,
    CustomerNotificationProcessor,
    CustomerNotificationSweeper,
    CustomerNotificationsHealthService,
    NotificationPreferencesService,
    NotificationStalenessService,
    ReminderSchedulerService,
    WhatsAppOptOutService,
    WhatsAppSenderResolver,
    WhatsAppStatusService,
    WhatsAppWebhookEventProcessor,
    WhatsAppWebhookService,
    WhatsAppWebhookSweeper,
  ],
  exports: [CustomerNotificationEmitter],
})
export class CustomerNotificationsModule {}
