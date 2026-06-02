
import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule } from '@nestjs/throttler';
import { ScheduleModule } from '@nestjs/schedule';
import { BullModule } from '@nestjs/bullmq';

import { SharedModule } from './shared/shared.module';
import { AuthModule } from './modules/auth/auth.module';
import { WorkshopModule } from './modules/workshop/workshop.module';
import { StockModule } from './modules/stock/stock.module';
import { BillingModule } from './modules/billing/billing.module';
import { CustomersModule } from './modules/customers/customers.module';
import { VehiclesModule } from './modules/vehicles/vehicles.module';
import { TeamModule } from './modules/team/team.module';
import { PlanningModule } from './modules/planning/planning.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { ReportsModule } from './modules/reports/reports.module';
import { CounterSalesModule } from './modules/counter-sales/counter-sales.module';
import { SettingsModule } from './modules/settings/settings.module';
import { EventsModule } from './modules/events/events.module';
import { MarketingModule } from './modules/marketing/marketing.module';
import { SignupModule } from './modules/signup/signup.module';
import { SchedulerService } from './workers/scheduler.service';
import { SmsProcessor } from './workers/sms.processor';
import { JwtAuthGuard, PermissionsGuard } from './guards/auth.guard';
import { AppController } from './app.controller';

@Module({
  controllers: [AppController],
  imports: [
    // 1. Fondations
    SharedModule,
    ThrottlerModule.forRoot([{
      ttl: 60000,
      limit: 100,
    }]),
    ScheduleModule.forRoot(),
    BullModule.forRoot({
      connection: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
        // On évite que le serveur ne crashe si Redis est absent
        connectionName: 'atelier-dev',
        maxRetriesPerRequest: 0,
      },
    }),

    // 2. Authentification (Priorité haute)
    AuthModule,

    // 3. Métier (Atelier, Stock, Facturation)
    WorkshopModule,
    StockModule,
    BillingModule,
    CustomersModule,
    VehiclesModule,
    TeamModule,
    PlanningModule,
    NotificationsModule,
    ReportsModule,
    CounterSalesModule,
    SettingsModule,
    EventsModule,
    MarketingModule,
    SignupModule,

    // 4. Background Jobs (Workers & Schedulers)
    BullModule.registerQueue(
      { name: 'sms-notifications' },
      { name: 'stock-alerts' },
    ),
  ],
  providers: [
    SchedulerService,
    SmsProcessor,
    // Guards Globaux
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: PermissionsGuard,
    },
  ],
})
export class AppModule { }
