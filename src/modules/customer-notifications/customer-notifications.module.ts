import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { MessagingModule } from '../messaging';
import { SubscriptionModule } from '../subscription/subscription.module';
import { CustomerNotificationEmitter } from './customer-notification.emitter';
import { CustomerNotificationProcessor } from './customer-notification.processor';
import { CustomerNotificationSweeper } from './customer-notification.sweeper';
import { CUSTOMER_NOTIFICATIONS_CONFIG, loadCustomerNotificationsConfig } from './customer-notifications.config';
import { CUSTOMER_NOTIFICATIONS_QUEUE } from './customer-notifications.queue';
import { NotificationPreferencesService } from './notification-preferences.service';
import { NotificationStalenessService } from './notification-staleness.service';
import { WhatsAppSenderResolver } from './whatsapp-sender.resolver';

/**
 * Notifications client (WhatsApp d'abord) — voir docs/architecture/notifications-client.md.
 * Les services métier n'importent que `CustomerNotificationEmitter`.
 * Configuration lue au démarrage : invalide = l'API refuse de démarrer.
 */
@Module({
  imports: [
    BullModule.registerQueue({ name: CUSTOMER_NOTIFICATIONS_QUEUE }),
    MessagingModule,
    SubscriptionModule,
  ],
  providers: [
    { provide: CUSTOMER_NOTIFICATIONS_CONFIG, useFactory: () => loadCustomerNotificationsConfig() },
    CustomerNotificationEmitter,
    CustomerNotificationProcessor,
    CustomerNotificationSweeper,
    NotificationPreferencesService,
    NotificationStalenessService,
    WhatsAppSenderResolver,
  ],
  exports: [CustomerNotificationEmitter],
})
export class CustomerNotificationsModule {}
