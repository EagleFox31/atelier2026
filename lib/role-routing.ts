import type { ApiUser } from '@/lib/api';

const ELEVATED_ROLES = ['ADMIN', 'SUPER_ADMIN', 'CHEF_ATELIER', 'RECEPTIONNISTE', 'CAISSIER'] as const;

/** Réceptionniste — voit uniquement ses propres OT. */
export function isReceptionnisteProfile(user: ApiUser | null | undefined): boolean {
  if (!user?.roles?.length) return false;
  return user.roles.includes('RECEPTIONNISTE') && !user.roles.some(r => ['ADMIN', 'SUPER_ADMIN', 'CHEF_ATELIER'].includes(r));
}

/** Technicien « pur » — sans rôle bureau (réception, caisse, chef, admin). */
export function isTechnicianProfile(user: ApiUser | null | undefined): boolean {
  if (!user?.roles?.length) return false;
  return user.roles.includes('TECHNICIEN') && !user.roles.some(r => ELEVATED_ROLES.includes(r as typeof ELEVATED_ROLES[number]));
}

/** Page d'accueil après connexion selon le profil. */
export function getDefaultHomeRoute(user: ApiUser | null | undefined): string {
  if (isTechnicianProfile(user)) return '/workshop';
  return '/';
}

/** Priorise le retour post-401, sinon route par défaut du rôle. */
export function resolvePostLoginRoute(user: ApiUser | null | undefined, returnUrl?: string | null): string {
  if (returnUrl && returnUrl.startsWith('/') && returnUrl !== '/login') {
    return returnUrl;
  }
  return getDefaultHomeRoute(user);
}

/** Routes de la barre du bas mobile pour le technicien. */
export const TECH_MOBILE_NAV = [
  { href: '/workshop', label: 'OT' },
  { href: '/stock', label: 'Stock' },
  { href: '/vehicles', label: 'Véhicules' },
] as const;
