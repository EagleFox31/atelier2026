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

/** Caissier « pur » — sans rôle admin/chef/réception. */
export function isCaissierProfile(user: ApiUser | null | undefined): boolean {
  if (!user?.roles?.length) return false;
  return user.roles.includes('CAISSIER') && !user.roles.some(r => ['ADMIN', 'SUPER_ADMIN', 'CHEF_ATELIER', 'RECEPTIONNISTE'].includes(r));
}

/** Chemins marketing / auth — jamais utilisés comme retour post-login. */
const NON_APP_RETURN_PATHS = ['/', '/accueil', '/login', '/forgot-password', '/demo'];

/** Page d'accueil après connexion selon le profil. */
export function getDefaultHomeRoute(user: ApiUser | null | undefined): string {
  if (isTechnicianProfile(user)) return '/workshop';
  return '/dashboard';
}

/** Priorise le retour post-401, sinon route par défaut du rôle. */
export function resolvePostLoginRoute(user: ApiUser | null | undefined, returnUrl?: string | null): string {
  const pathOnly = returnUrl?.split('?')[0];
  if (
    pathOnly &&
    pathOnly.startsWith('/') &&
    !NON_APP_RETURN_PATHS.includes(pathOnly)
  ) {
    return returnUrl!;
  }
  return getDefaultHomeRoute(user);
}

/** Routes de la barre du bas mobile pour le technicien. */
export const TECH_MOBILE_NAV = [
  { href: '/workshop', label: 'OT' },
  { href: '/stock', label: 'Stock' },
  { href: '/vehicles', label: 'Véhicules' },
] as const;

export interface MobileNavItem {
  href: string;
  label: string;
  search?: string;
}

/** Barre du bas mobile pour le réceptionniste (accueil comptoir). */
export const RECEPTION_MOBILE_NAV: MobileNavItem[] = [
  { href: '/reception', label: 'Réception' },
  { href: '/workshop', label: 'OT' },
  { href: '/planning', label: 'RDV', search: '?new=1' },
];

/** Barre du bas mobile pour le caissier (encaissement-first). */
export const CASHIER_MOBILE_NAV: MobileNavItem[] = [
  { href: '/cashier/collect', label: 'Encaisser' },
  { href: '/cashier/receivables', label: 'Impayés' },
  { href: '/cashier/closing', label: 'Clôture' },
];
