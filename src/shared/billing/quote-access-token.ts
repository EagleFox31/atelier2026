import type { PrismaClient } from '@prisma/client';
import { generateOpaqueToken, hashOpaqueToken } from '../security/opaque-token';

/**
 * Lien public de devis (`/devis/<jeton>`) envoyé au client par WhatsApp.
 *
 * - Jeton créé au moment de l'envoi, jamais stocké en clair (`quote_access_tokens.token_hash`).
 * - Un seul lien actif par devis : en émettre un nouveau révoque les précédents non utilisés.
 * - Validité : QUOTE_LINK_TTL_DAYS, bornée par la date de validité du devis.
 */
export const QUOTE_LINK_TTL_DAYS = 30;
const DAY_MS = 24 * 60 * 60_000;
/** Douala = UTC+1 sans heure d'été. */
const DOUALA_OFFSET_MS = 60 * 60_000;

/** Fin (exclue) du jour `validUntil` à Douala ; `null` si le devis n'a pas de date de validité. */
export function quoteValidityEnd(validUntil: Date | null | undefined): Date | null {
  if (!validUntil) return null;
  // `validUntil` est une colonne DATE : minuit UTC du jour concerné.
  return new Date(validUntil.getTime() + DAY_MS - DOUALA_OFFSET_MS);
}

export function quoteLinkExpiry(now: Date, validUntil?: Date | null): Date {
  const ttlEnd = new Date(now.getTime() + QUOTE_LINK_TTL_DAYS * DAY_MS);
  const validityEnd = quoteValidityEnd(validUntil);
  return validityEnd && validityEnd < ttlEnd ? validityEnd : ttlEnd;
}

type QuoteAccessTokenClient = Pick<PrismaClient, '$transaction' | 'quoteAccessToken'>;

/**
 * Émet un nouveau lien pour le devis et renvoie le jeton brut (à placer dans le message, puis oublié).
 * Révocation des anciens liens et création du nouveau dans une seule transaction.
 */
export async function issueQuoteAccessToken(
  prisma: QuoteAccessTokenClient,
  input: { garageId: string; quoteId: string; notificationId?: string | null; validUntil?: Date | null; now?: Date },
): Promise<string> {
  const now = input.now ?? new Date();
  const token = generateOpaqueToken();
  await prisma.$transaction([
    prisma.quoteAccessToken.updateMany({
      where: { quoteId: input.quoteId, revokedAt: null, decidedAt: null },
      data: { revokedAt: now },
    }),
    prisma.quoteAccessToken.create({
      data: {
        garageId: input.garageId,
        quoteId: input.quoteId,
        tokenHash: hashOpaqueToken(token),
        expiresAt: quoteLinkExpiry(now, input.validUntil),
        notificationId: input.notificationId ?? null,
      },
    }),
  ]);
  return token;
}
