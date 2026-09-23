import { Module } from '@nestjs/common';
import { SubscriptionModule } from '../subscription/subscription.module';
import { SharedModule } from '../../shared/shared.module';
import { SettingsController } from './settings.controller';
import { SettingsService } from './settings.service';

@Module({
  imports: [SharedModule, SubscriptionModule],
  controllers: [SettingsController],
  providers: [SettingsService],
  exports: [SettingsService],
})
export class SettingsModule {}
