import { IsOptional, IsString, MaxLength } from 'class-validator';

/** Refus d'un devis depuis le lien public : motif facultatif, transmis au garage. */
export class RejectPublicQuoteDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
