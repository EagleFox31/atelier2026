import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsEmail,
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

const TEAM_ROLE_CODES = [
  'CHEF_ATELIER',
  'RECEPTIONNISTE',
  'TECHNICIEN',
  'CAISSIER',
] as const;

export class SignupAdminDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  firstName!: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  lastName!: string;

  @IsEmail()
  email!: string;

  @IsOptional()
  @IsString()
  @MinLength(8)
  phone?: string;

  @IsString()
  @MinLength(8)
  password!: string;
}

export class SignupWorkshopDto {
  @IsString()
  @IsNotEmpty()
  shopName!: string;

  @IsOptional()
  @IsString()
  tagline?: string;

  @IsOptional()
  @IsString()
  niu?: string;

  @IsEmail()
  email!: string;

  @IsString()
  @IsNotEmpty()
  phone!: string;

  @IsString()
  @IsNotEmpty()
  address!: string;

  @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  defaultLaborRateXaf?: number;
}

export class SignupTeamMemberDto {
  @IsIn(TEAM_ROLE_CODES)
  roleCode!: (typeof TEAM_ROLE_CODES)[number];

  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  firstName!: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  lastName!: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  phone?: string;
}

export class SignupDto {
  @ValidateNested()
  @Type(() => SignupAdminDto)
  admin!: SignupAdminDto;

  @ValidateNested()
  @Type(() => SignupWorkshopDto)
  workshop!: SignupWorkshopDto;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(8)
  @ValidateNested({ each: true })
  @Type(() => SignupTeamMemberDto)
  team?: SignupTeamMemberDto[];
}
