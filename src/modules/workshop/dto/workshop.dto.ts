import {
  IsArray, IsBoolean, IsDateString, IsEnum, IsIn, IsInt, IsNotEmpty, IsNumber,
  IsOptional, IsPositive, IsString, IsUUID, Min, Max, ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { OTStatus, CheckResult } from '@prisma/client';

export class CreateServiceOrderDto {
  @IsUUID()
  @IsNotEmpty()
  vehicleId!: string;

  @IsUUID()
  @IsNotEmpty()
  customerId!: string;

  @IsString()
  @IsNotEmpty()
  clientComplaint!: string;

  @IsIn(['LOW', 'NORMAL', 'HIGH', 'URGENT'])
  @IsOptional()
  priority?: string;

  @IsInt()
  @Min(0)
  @IsOptional()
  mileageIn?: number;

  @IsDateString()
  @IsOptional()
  promisedAt?: string;

  @IsUUID()
  @IsOptional()
  appointmentId?: string;
}

export class UpdateOTDto {
  @IsString()
  @IsOptional()
  clientComplaint?: string;

  @IsIn(['LOW', 'NORMAL', 'HIGH', 'URGENT'])
  @IsOptional()
  priority?: string;

  @IsInt()
  @Min(0)
  @IsOptional()
  mileageIn?: number;

  @IsDateString()
  @IsOptional()
  promisedAt?: string;

  @IsUUID()
  @IsOptional()
  vehicleId?: string;

  @IsUUID()
  @IsOptional()
  customerId?: string;
}

export class PartReconciliationItemDto {
  @IsUUID()
  quoteLineId!: string;

  @IsBoolean()
  used!: boolean;

  @IsNumber()
  @IsOptional()
  aspPurchasePrice?: number;
}

export class UpdateOTStatusDto {
  @IsEnum(OTStatus)
  status!: OTStatus;

  @IsString()
  @IsOptional()
  reason?: string;

  @IsString()
  @IsOptional()
  cancellationReason?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PartReconciliationItemDto)
  @IsOptional()
  partsReconciliation?: PartReconciliationItemDto[];
}

export class CreateObservationDto {
  @IsString()
  @IsNotEmpty()
  description!: string;

  @IsIn(['MECANIQUE', 'CARROSSERIE', 'ELECTRIQUE', 'PNEUMATIQUE', 'CLIMATISATION', 'TRANSMISSION', 'SUSPENSION', 'AUTRE'])
  @IsOptional()
  category?: string;

  @IsIn(['INFO', 'WARNING', 'URGENT'])
  @IsOptional()
  severity?: string;

  @IsBoolean()
  @IsOptional()
  includeInQuote?: boolean;
}

export class CreateWorkItemDto {
  @IsUUID()
  @IsNotEmpty()
  laborCatalogId!: string;

  @IsNumber()
  @IsPositive()
  @IsOptional()
  quantity?: number;

  @IsNumber()
  @Min(0)
  @Max(100)
  @IsOptional()
  discountPct?: number;

  @IsNumber()
  @IsPositive()
  unitPriceXaf!: number;
}

export class ReceptionCheckItemDto {
  @IsUUID()
  @IsNotEmpty()
  catalogId!: string;

  @IsIn(['OK', 'WARNING', 'CRITICAL', 'NA'])
  @IsOptional()
  result?: string;

  @IsString()
  @IsOptional()
  note?: string;
}

export class CreateReceptionCheckDto {
  @IsInt()
  @Min(0)
  mileageAtReception!: number;

  @IsInt()
  @Min(0)
  @Max(8)
  @IsOptional()
  fuelLevel?: number;

  @IsString()
  @IsOptional()
  globalNotes?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReceptionCheckItemDto)
  @IsOptional()
  checkItems?: ReceptionCheckItemDto[];
}

export class CreateQualityControlDto {
  @IsEnum(CheckResult)
  overallResult!: CheckResult;

  @IsArray()
  @IsOptional()
  checklist?: any[];

  @IsString()
  @IsOptional()
  returnNotes?: string;
}
