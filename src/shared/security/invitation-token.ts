import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

/**
 * Jetons d'invitation d'équipe (#15).
 *
 * - 32 octets aléatoires (CSPRNG) → 256 bits, encodés en base64url (43 caractères) dans le lien
 *   UNIQUEMENT. Le jeton brut n'est ni stocké, ni journalisé.
 * - En base : empreinte SHA-256 (hex, colonne unique). Un jeton à 256 bits d'entropie n'a pas
 *   besoin d'un hachage lent (bcrypt) : l'empreinte n'est pas inversible et la recherche par
 *   empreinte ne compare jamais le secret lui-même.
 * - Validité : INVITATION_TTL_HOURS, usage unique (acceptation conditionnelle atomique).
 */
export const INVITATION_TOKEN_BYTES = 32;
export const INVITATION_TTL_HOURS = 72;
export const INVITATION_TTL_MS = INVITATION_TTL_HOURS * 60 * 60 * 1000;

const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

export type InvitationStatus = 'none' | 'pending' | 'expired' | 'accepted';

export type IssuedInvitation = {
  /** Jeton brut — à placer dans le lien de l'e-mail, puis oublié. */
  token: string;
  /** Champs Prisma à écrire sur l'utilisateur. */
  data: {
    inviteTokenHash: string;
    inviteExpiresAt: Date;
    inviteSentAt: Date;
    inviteAcceptedAt: null;
  };
};

export function hashInvitationToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}

/** Rejette tôt (sans requête DB) tout ce qui n'a pas la forme d'un jeton émis. */
export function isWellFormedInvitationToken(token: unknown): token is string {
  return typeof token === 'string' && TOKEN_PATTERN.test(token);
}

/** Comparaison à temps constant de deux empreintes hex (défense en profondeur après la recherche). */
export function invitationHashMatches(expectedHex: string, actualHex: string): boolean {
  const a = Buffer.from(expectedHex, 'hex');
  const b = Buffer.from(actualHex, 'hex');
  return a.length === b.length && a.length > 0 && timingSafeEqual(a, b);
}

/** Nouveau jeton + champs à persister. Un nouvel envoi remplace l'empreinte : l'ancien lien meurt. */
export function issueInvitation(now: Date = new Date()): IssuedInvitation {
  const token = randomBytes(INVITATION_TOKEN_BYTES).toString('base64url');
  return {
    token,
    data: {
      inviteTokenHash: hashInvitationToken(token),
      inviteExpiresAt: new Date(now.getTime() + INVITATION_TTL_MS),
      inviteSentAt: now,
      inviteAcceptedAt: null,
    },
  };
}

/** Statut dérivé, exposé aux écrans (jamais l'empreinte). */
export function invitationStatusOf(
  user: {
    inviteTokenHash?: string | null;
    inviteExpiresAt?: Date | null;
    inviteAcceptedAt?: Date | null;
  },
  now: Date = new Date(),
): InvitationStatus {
  if (user.inviteAcceptedAt) return 'accepted';
  if (!user.inviteTokenHash) return 'none';
  if (user.inviteExpiresAt && user.inviteExpiresAt.getTime() > now.getTime()) return 'pending';
  return 'expired';
}

/** Mot de passe de remplissage inutilisable : le compte invité ne peut pas se connecter avant acceptation. */
export function unusablePassword(): string {
  return randomBytes(32).toString('base64url');
}
