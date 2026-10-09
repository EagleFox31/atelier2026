import { Body, Controller, Get, Param, Patch, Put, Query } from '@nestjs/common';
import { CurrentUser, RequirePermission, RequireRole } from '../../decorators/auth.decorator';
import { CustomerConsentService } from './customer-consent.service';
import { CustomerNotificationHistoryService } from './customer-notification-history.service';
import {
  ConsentChannelParamDto,
  CustomerParamDto,
  NotificationHistoryQueryDto,
  RecordConsentDto,
  UpdateNotificationSettingsDto,
} from './dto/customer-notifications.dto';
import { NotificationPreferencesService } from './notification-preferences.service';

/** Consentement et historique des notifications d'un client (mêmes permissions que la fiche client). */
@Controller('customers/:customerId')
export class CustomerNotificationsController {
  constructor(
    private readonly consents: CustomerConsentService,
    private readonly history: CustomerNotificationHistoryService,
  ) {}

  @Get('notification-consents')
  @RequirePermission('VEH_VIEW')
  listConsents(@CurrentUser() user: any, @Param() params: CustomerParamDto) {
    return this.consents.list(params.customerId, user?.garageId);
  }

  @Put('notification-consents/:channel')
  @RequirePermission('VEH_CREATE')
  recordConsent(@CurrentUser() user: any, @Param() params: ConsentChannelParamDto, @Body() body: RecordConsentDto) {
    return this.consents.record(params.customerId, params.channel, body, user?.garageId, user?.id);
  }

  @Get('notifications')
  @RequirePermission('VEH_VIEW')
  listNotifications(
    @CurrentUser() user: any,
    @Param() params: CustomerParamDto,
    @Query() query: NotificationHistoryQueryDto,
  ) {
    return this.history.listForCustomer(params.customerId, user?.garageId, query.limit);
  }
}

/** Activation des notifications client par événement, pour le garage courant. */
@Controller('settings/notifications')
export class NotificationSettingsController {
  constructor(private readonly preferences: NotificationPreferencesService) {}

  @Get()
  list(@CurrentUser() user: any) {
    return this.preferences.list(user?.garageId);
  }

  @Patch()
  @RequireRole('ADMIN', 'SUPER_ADMIN')
  update(@CurrentUser() user: any, @Body() body: UpdateNotificationSettingsDto) {
    return this.preferences.update(user?.garageId, body.settings, user?.id);
  }
}
