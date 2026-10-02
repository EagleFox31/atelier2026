/**
 * Limites de débit — table unique (LESSON-2026-009).
 *
 * Global : généreux, car tout un garage partage souvent la même IP publique
 * (box de l'atelier) ; il ne doit freiner que les abus, jamais l'usage normal.
 * Points sensibles (non authentifiés, cibles de force brute / spam) : stricts, par IP client.
 *
 * Usage : @Throttle(RATE_LIMITS.login) sur la route ; la garde globale
 * ClientIpThrottlerGuard (AppModule) les applique. Désactivable en local
 * avec RATE_LIMIT_ENABLED=false (ex. collections Postman), jamais en production.
 */
const MINUTE = 60_000;

export const GLOBAL_RATE_LIMIT = { ttl: MINUTE, limit: 600 };

export const RATE_LIMITS = {
  /** Connexion : freine la force brute sur les mots de passe. */
  login: { default: { ttl: MINUTE, limit: 10 } },
  /** Mot de passe oublié : notifie l'admin, à protéger du spam. */
  forgotPassword: { default: { ttl: 15 * MINUTE, limit: 5 } },
  /** Inscription libre-service : création de tenant. */
  signup: { default: { ttl: MINUTE, limit: 5 } },
  /** Formulaire de démo public. */
  demoBooking: { default: { ttl: MINUTE, limit: 6 } },
  /** Lecture d'une invitation (affichage de la page d'activation). */
  invitationRead: { default: { ttl: MINUTE, limit: 20 } },
  /** Activation d'une invitation (choix du mot de passe). */
  invitationAccept: { default: { ttl: MINUTE, limit: 5 } },
} as const;

export function isRateLimitEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.RATE_LIMIT_ENABLED?.trim().toLowerCase() !== 'false';
}
