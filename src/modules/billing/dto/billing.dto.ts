import {
  IsArray, IsDateString, IsEnum, IsIn, IsNotEmpty, IsNumber, IsOptional, IsPositive,
  IsString, IsUUID, Min, ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { PaymentMethod } from '@prisma/client';

export class QuoteLineDto {
  @IsIn(['LABOR', 'PART'])
  lineType!: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsUUID()
  @IsOptional()
  laborCatalogId?: string;

  @IsUUID()
  @IsOptional()
  partId?: string;

  @IsNumber()
  @IsPositive()
  quantity!: number;

  @IsNumber()
  @IsPositive()
  unitPriceXaf!: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  discountPct?: number;

  @IsUUID()
  @IsOptional()
  observationId?: string;
}

export class CreateQuoteDto {
  @IsUUID()
  @IsNotEmpty()
  serviceOrderId!: string;

  @IsUUID()
  @IsNotEmpty()
  customerId!: string;

  @IsNumber()
  @IsPositive()
  subtotal!: number;

  @IsString()
  @IsOptional()
  notes?: string;

  @IsDateString()
  @IsOptional()
  validUntil?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => QuoteLineDto)
  lines!: QuoteLineDto[];
}

export class RecordPaymentDto {
  @IsUUID()
  @IsNotEmpty()
  invoiceId!: string;

  @IsNumber()
  @IsPositive()
  amount!: number;

  @IsEnum(PaymentMethod)
  method!: PaymentMethod;

  @IsString()
  @IsOptional()
  transactionRef?: string;

  @IsString()
  @IsOptional()
  idempotencyKey?: string;
}

export class CloseCashDayDto {
  @IsDateString()
  @IsOptional()
  date?: string;

  @IsNumber()
  @Min(0)
  @IsOptional()
  countedCash?: number;

  @IsString()
  @IsOptional()
  notes?: string;
}
