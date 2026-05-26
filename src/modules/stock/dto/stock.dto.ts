import {
  IsEnum, IsInt, IsNotEmpty, IsNumber, IsOptional, IsPositive, IsString, IsUUID, Min, IsArray, IsBoolean,
} from 'class-validator';
import { PartialType } from '@nestjs/swagger';
import { StockMovementType } from '@prisma/client';

export class CreateStockMovementDto {
  @IsUUID()
  @IsNotEmpty()
  partId!: string;

  @IsEnum(StockMovementType)
  type!: StockMovementType;

  @IsNumber()
  quantity!: number;

  @IsUUID()
  @IsOptional()
  serviceOrderId?: string;

  @IsString()
  @IsOptional()
  referenceDoc?: string;

  @IsNumber()
  @IsPositive()
  @IsOptional()
  unitPriceXaf?: number;
}

export class CreateASPDto {
  @IsUUID()
  @IsNotEmpty()
  partId!: string;

  @IsUUID()
  @IsNotEmpty()
  serviceOrderId!: string;

  @IsNumber()
  @IsPositive()
  quantity!: number;

  @IsNumber()
  @IsPositive()
  purchasePrice!: number;

  @IsNumber()
  @IsPositive()
  salePrice!: number;

  @IsString()
  @IsNotEmpty()
  supplierName!: string;
}

export class CreatePartDto {
  @IsString()
  @IsNotEmpty()
  reference!: string;

  @IsString()
  @IsOptional()
  oemReference?: string;

  @IsString()
  @IsOptional()
  barcode?: string;

  @IsString()
  @IsNotEmpty()
  nameFr!: string;

  @IsString()
  @IsOptional()
  nameEn?: string;

  @IsString()
  @IsNotEmpty()
  category!: string;

  @IsString()
  @IsOptional()
  unit?: string;

  @IsNumber()
  @IsPositive()
  @IsOptional()
  purchasePriceXaf?: number;

  @IsNumber()
  @IsPositive()
  salePriceXaf!: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  qtyInStock?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  minThreshold?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  maxThreshold?: number;

  @IsString()
  @IsOptional()
  storageLocation?: string;

  @IsUUID()
  @IsOptional()
  preferredSupplierId?: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  compatibleMakes?: string[];

  @IsBoolean()
  @IsOptional()
  isConsumable?: boolean;
}

export class UpdatePartDto extends PartialType(CreatePartDto) {}
