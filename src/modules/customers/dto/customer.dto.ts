import { IsEnum, IsNotEmpty, IsOptional, IsString, IsEmail, IsBoolean } from 'class-validator';
import { CustomerType } from '@prisma/client';
import { PartialType } from '@nestjs/swagger';

export class CreateCustomerDto {
    @IsEnum(CustomerType)
    @IsOptional()
    customerType?: CustomerType;         // Prisma: customerType

    @IsString()
    @IsNotEmpty()
    lastName!: string;                   // Prisma: lastName

    @IsString()
    @IsOptional()
    firstName?: string;

    @IsString()
    @IsOptional()
    companyName?: string;

    @IsString()
    @IsOptional()
    rccm?: string;                       // Prisma: rccm (registre commerce)

    @IsString()
    @IsOptional()
    niu?: string;                        // Prisma: niu (anciennement vatNumber)

    @IsEmail()
    @IsOptional()
    email?: string;

    @IsString()
    @IsNotEmpty()
    phonePrimary!: string;               // Prisma: phonePrimary

    @IsString()
    @IsOptional()
    phoneSecondary?: string;

    @IsString()
    @IsOptional()
    address?: string;

    @IsString()
    @IsOptional()
    city?: string;

    @IsBoolean()
    @IsOptional()
    isVip?: boolean;

    @IsString()
    @IsOptional()
    lang?: string;

    @IsOptional()
    creditLimitXaf?: number;

    @IsString()
    @IsOptional()
    notes?: string;
}

export class UpdateCustomerDto extends PartialType(CreateCustomerDto) { }
