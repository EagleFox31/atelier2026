import { Module } from '@nestjs/common';
import { SharedModule } from '../../shared/shared.module';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { BullModule } from '@nestjs/bullmq';
import { SubscriptionModule } from '../subscription/subscription.module';
import { MessagingModule } from '../messaging';
import { WhatsAppTestController } from './whatsapp-test.controller';
import { WhatsAppTestService } from './whatsapp-test.service';

@Module({
  imports: [
    SharedModule,
    SubscriptionModule,
    MessagingModule,
    BullModule.registerQueue({ name: 'sms-notifications' }),
  ],
  controllers: [NotificationsController, WhatsAppTestController],
  providers: [NotificationsService, WhatsAppTestService],
  exports: [NotificationsService],
})
export class NotificationsModule {}
