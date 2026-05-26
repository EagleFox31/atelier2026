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
    @MinLength(8)
    @IsOptional()
    password?: string;
}

export class UpdateTeamMemberDto extends PartialType(OmitType(CreateTeamMemberDto, ['roleCode', 'password'] as const)) {}

export class AssignRoleDto {
    @IsString()
    @IsNotEmpty()
    roleCode!: string;
}
