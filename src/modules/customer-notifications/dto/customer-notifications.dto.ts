import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsBoolean,
  IsEnum,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { ConsentSource, ConsentStatus, CustomerNotificationEvent } from '@prisma/client';

/** Accord ou retrait du consentement WhatsApp, recueilli par le personnel du garage. */
export class RecordConsentDto {
  @IsEnum(ConsentStatus)
  status!: ConsentStatus;

  @IsEnum(ConsentSource)
  source!: ConsentSource;

  /** Numéro autorisé ; absent = numéro principal du client. */
  @IsOptional()
  @IsString()
  @MaxLength(32)
  phone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

/** Seul canal client du lot 2. */
export const CONSENT_CHANNELS = ['WHATSAPP'] as const;
export type ConsentChannelParam = (typeof CONSENT_CHANNELS)[number];

export class CustomerParamDto {
  @IsUUID()
  customerId!: string;
}

export class ConsentChannelParamDto extends CustomerParamDto {
  @IsIn(CONSENT_CHANNELS)
  channel!: ConsentChannelParam;
}

export class NotificationHistoryQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}

export class NotificationSettingItemDto {
  @IsEnum(CustomerNotificationEvent)
  eventType!: CustomerNotificationEvent;

  @IsBoolean()
  enabled!: boolean;
}

export class UpdateNotificationSettingsDto {
  @ValidateNested({ each: true })
  @Type(() => NotificationSettingItemDto)
  @ArrayMinSize(1)
  @ArrayMaxSize(Object.keys(CustomerNotificationEvent).length)
  @IsNotEmpty()
  settings!: NotificationSettingItemDto[];
}
