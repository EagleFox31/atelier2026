/**
 * Configuration SEO/GEO d'Atelier Maître : URL canonique, éditeur, pages
 * publiques indexables et routes exclues de l'index. Source unique pour
 * `robots.ts`, `sitemap.ts`, `llms.txt`, les en-têtes `X-Robots-Tag`
 * (next.config.ts) et la liste des chemins publics d'`AppLayout`.
 *
 * Ce module ne doit importer aucun code React : next.config.ts le charge.
 */

/** URL publique canonique (surchargeable pour un environnement de recette). */
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://atelier.trigenys.com').replace(/\/+$/, '');

export const SITE_NAME = 'Atelier Maître';

/** Organisation éditrice, déclarée sur le site vitrine Trigenys. */
export const PUBLISHER = {
  id: 'https://www.trigenys.com/#org',
  name: 'Trigenys Group',
  url: 'https://www.trigenys.com',
} as const;

export type MarketingPage = {
  path: string;
  /** Libellé court pour la navigation et le pied de page. */
  label: string;
  changeFrequency: 'weekly' | 'monthly';
  priority: number;
};

/**
 * Pages publiques indexables, dans l'ordre du sitemap. Ajouter une page ici
 * l'ouvre aux visiteurs non connectés (AppLayout) et au sitemap.
 */
export const MARKETING_PAGES: readonly MarketingPage[] = [
  { path: '/', label: 'Accueil', changeFrequency: 'weekly', priority: 1 },
  { path: '/logiciel-garage-cameroun', label: 'Logiciel garage Cameroun', changeFrequency: 'monthly', priority: 0.9 },
  { path: '/tarifs', label: 'Tarifs', changeFrequency: 'monthly', priority: 0.9 },
  { path: '/ordre-de-travail-atelier', label: 'Ordre de travail atelier', changeFrequency: 'monthly', priority: 0.8 },
  { path: '/facture-garage-xaf', label: 'Facture garage en XAF', changeFrequency: 'monthly', priority: 0.8 },
  { path: '/gestion-stock-pieces-auto', label: 'Stock de pièces auto', changeFrequency: 'monthly', priority: 0.8 },
  { path: '/planning-atelier', label: 'Planning atelier', changeFrequency: 'monthly', priority: 0.8 },
  { path: '/sms-clients-garage', label: 'SMS clients garage', changeFrequency: 'monthly', priority: 0.8 },
  { path: '/comparatif-excel-cahier', label: 'Atelier Maître vs Excel ou cahier', changeFrequency: 'monthly', priority: 0.7 },
  { path: '/faq', label: 'Questions fréquentes', changeFrequency: 'monthly', priority: 0.7 },
  { path: '/demo', label: 'Réserver une démo', changeFrequency: 'monthly', priority: 0.8 },
];

/**
 * Pages publiques mais sans valeur de recherche (formulaires de compte) :
 * crawlables pour que le `noindex` soit lu, jamais indexées.
 */
export const NOINDEX_PUBLIC_PATHS: readonly string[] = [
  '/login',
  '/inscription',
  '/forgot-password',
  '/change-password',
  '/invitation',
];

/**
 * Espace applicatif authentifié et liens à jeton : interdits aux robots et
 * marqués `noindex`. Préfixes de chemin (un préfixe couvre ses sous-routes).
 */
export const APP_PATH_PREFIXES: readonly string[] = [
  '/admin',
  '/audit',
  '/billing',
  '/cashier',
  '/contact',
  '/customers',
  '/dashboard',
  '/demo-requests',
  '/devis',
  '/help',
  '/history',
  '/notifications',
  '/planning',
  '/reception',
  '/reports',
  '/settings',
  '/stock',
  '/team',
  '/vehicles',
  '/workshop',
  '/api',
];

export function absoluteUrl(path: string): string {
  return path === '/' ? `${SITE_URL}/` : `${SITE_URL}${path}`;
}
