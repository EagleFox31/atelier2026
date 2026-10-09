import {
  ArrayMaxSize,
  IsArray,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
} from 'class-validator';

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

export class SendWhatsAppTestDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(32)
  to!: string;

  /** Nom du modèle approuvé chez Meta (défaut `hello_world`). */
  @IsOptional()
  @Matches(/^[a-z0-9_]{1,512}$/)
  templateName?: string;

  /** Code langue du modèle (défaut `en_US`, celui de `hello_world`). */
  @IsOptional()
  @Matches(/^[a-z]{2,3}(_[A-Z]{2})?$/)
  language?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsString({ each: true })
  @MaxLength(1024, { each: true })
  variables?: string[];
}
