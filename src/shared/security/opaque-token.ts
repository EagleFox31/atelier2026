import { createHash, randomBytes } from 'node:crypto';

/**
 * Jetons opaques des liens publics (invitation d'équipe, lien de devis…).
 *
 * - 32 octets aléatoires (CSPRNG) → 256 bits, encodés en base64url (43 caractères) dans le lien
 *   UNIQUEMENT. Le jeton brut n'est ni stocké, ni journalisé.
 * - En base : empreinte SHA-256 (hex, colonne unique). Un jeton à 256 bits d'entropie n'a pas
 *   besoin d'un hachage lent (bcrypt) : l'empreinte n'est pas inversible et la recherche par
 *   empreinte ne compare jamais le secret lui-même.
 */
export const OPAQUE_TOKEN_BYTES = 32;

const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

export function generateOpaqueToken(): string {
  return randomBytes(OPAQUE_TOKEN_BYTES).toString('base64url');
}

export function hashOpaqueToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}

/** Rejette tôt (sans requête DB) tout ce qui n'a pas la forme d'un jeton émis. */
export function isWellFormedOpaqueToken(token: unknown): token is string {
  return typeof token === 'string' && TOKEN_PATTERN.test(token);
}
