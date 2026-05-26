import { IsNotEmpty, IsOptional, IsString, IsInt, Min, Max, IsUUID, IsIn } from 'class-validator';
import { PartialType } from '@nestjs/swagger';

export class CreateVehicleDto {
    @IsUUID()
    @IsNotEmpty()
    customerId!: string;

    @IsString()
    @IsNotEmpty()
    plateNumber!: string;

    @IsIn(['NEW', 'OLD', 'FOREIGN'])
    @IsOptional()
    plateFormat?: string;

    @IsString()
    @IsOptional()
    vin?: string;

    @IsUUID()
    @IsOptional()
    makeId?: string;

    @IsUUID()
    @IsOptional()
    modelId?: string;

    @IsInt()
    @Min(1960)
    @Max(2030)
    @IsOptional()
    year?: number;

    @IsString()
    @IsOptional()
    color?: string;

    @IsIn(['PETROL', 'DIESEL', 'HYBRID', 'ELECTRIC', 'LPG', 'OTHER'])
    @IsOptional()
    fuelType?: string;

    @IsString()
    @IsOptional()
    engineCode?: string;

    @IsInt()
    @IsOptional()
    engineCc?: number;

    @IsIn(['MANUAL', 'AUTO', 'CVT', 'OTHER'])
    @IsOptional()
    transmission?: string;

    @IsInt()
    @IsOptional()
    currentMileage?: number;

    @IsString()
    @IsOptional()
    notes?: string;
}

export class UpdateVehicleDto extends PartialType(CreateVehicleDto) { }
