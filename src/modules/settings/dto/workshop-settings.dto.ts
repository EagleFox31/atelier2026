import { IsEmail, IsNotEmpty, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';

export class UpdateWorkshopSettingsDto {
  @IsString()
  @IsNotEmpty()
  shopName!: string;

  @IsString()
  @IsOptional()
  tagline?: string;

  @IsString()
  @IsOptional()
  niu?: string;

  @IsEmail()
  email!: string;

  @IsString()
  @IsNotEmpty()
  phone!: string;

  @IsString()
  @IsNotEmpty()
  address!: string;

  @IsNumber()
  @Min(0)
  @IsOptional()
  defaultLaborRateXaf?: number;

  @IsNumber()
  @Min(0)
  @Max(100)
  @IsOptional()
  taxRatePct?: number;
}
