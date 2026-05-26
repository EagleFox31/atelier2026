import { IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';

export class SendSmsDto {
  @IsString()
  @IsNotEmpty()
  phoneTo!: string;

  @IsString()
  @IsNotEmpty()
  templateCode!: string;

  @IsUUID()
  @IsOptional()
  customerId?: string;

  @IsString()
  @IsOptional()
  lang?: string;

  /** Message brut — optionnel si templateCode est reconnu */
  @IsString()
  @IsOptional()
  message?: string;
}
