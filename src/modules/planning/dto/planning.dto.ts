import { IsDateString, IsEnum, IsInt, IsNotEmpty, IsOptional, IsString, IsUUID, Min } from 'class-validator';
import { AppointmentStatus } from '@prisma/client';
import { PartialType } from '@nestjs/swagger';

export class CreateAppointmentDto {
    @IsUUID()
    @IsNotEmpty()
    customerId!: string;

    @IsUUID()
    @IsOptional()
    vehicleId?: string;

    @IsUUID()
    @IsOptional()
    serviceOrderId?: string;

    @IsDateString()
    @IsNotEmpty()
    scheduledAt!: string;

    @IsInt()
    @Min(15)
    @IsOptional()
    durationMinutes?: number;

    @IsString()
    @IsNotEmpty()
    reason!: string;

    @IsString()
    @IsOptional()
    notes?: string;
}

export class UpdateAppointmentDto extends PartialType(CreateAppointmentDto) {
    @IsEnum(AppointmentStatus)
    @IsOptional()
    status?: AppointmentStatus;
}
