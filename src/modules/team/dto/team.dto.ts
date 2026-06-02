import { IsEmail, IsNotEmpty, IsOptional, IsString, MinLength, ValidateIf } from 'class-validator';
import { PartialType, OmitType } from '@nestjs/swagger';

export class CreateTeamMemberDto {
    @IsString()
    @IsNotEmpty()
    firstName!: string;

    @IsString()
    @IsNotEmpty()
    lastName!: string;

    @ValidateIf((o) => o.email != null && o.email !== '')
    @IsEmail()
    @IsOptional()
    email?: string;

    @IsString()
    @IsOptional()
    phone?: string;

    @IsString()
    @IsOptional()
    roleCode?: string;

    @IsString()
    @IsOptional()
    specialty?: string;

    @IsString()
    @MinLength(6)
    @IsOptional()
    password?: string;
}

export class UpdateTeamMemberDto extends PartialType(OmitType(CreateTeamMemberDto, ['roleCode', 'password'] as const)) {}

export class ResetPasswordDto {
    @IsString()
    @MinLength(6)
    @IsOptional()
    password?: string;
}

export class AssignRoleDto {
    @IsString()
    @IsNotEmpty()
    roleCode!: string;
}
