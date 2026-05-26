import {
  IsArray,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateNested,
  ArrayMinSize,
} from 'class-validator';
import { Type } from 'class-transformer';
import { PaymentMethod } from '@prisma/client';

export class CounterSaleLineDto {
  @IsUUID()
  @IsNotEmpty()
  partId!: string;

  @IsNumber()
  @Min(0.001)
  quantity!: number;

  @IsNumber()
  @Min(0)
  unitPriceXaf!: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  discountPct?: number;
}

export class CreateCounterSaleDto {
  @IsUUID()
  @IsOptional()
  customerId?: string;

  @IsString()
  @IsOptional()
  walkInName?: string;

  @IsString()
  @IsOptional()
  walkInPhone?: string;

  @IsEnum(PaymentMethod)
  @IsOptional()
  paymentMethod?: PaymentMethod;

  @IsString()
  @IsOptional()
  paymentRef?: string;

  @IsString()
  @IsOptional()
  notes?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CounterSaleLineDto)
  lines!: CounterSaleLineDto[];
}
