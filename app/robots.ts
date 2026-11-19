import type { MetadataRoute } from 'next';
import { APP_PATH_PREFIXES, SITE_URL } from '@/lib/seo/site';

/**
 * Robots : landing et pages publiques ouvertes, espace applicatif fermé.
 * Chaque préfixe est bloqué à la frontière de segment (`/planning$`, `/planning/`)
 * pour ne pas bloquer une page publique qui commence pareil (`/planning-atelier`).
 * Les formulaires de compte (`/login`…) restent crawlables : leur `noindex`
 * (en-tête X-Robots-Tag, next.config.ts) doit pouvoir être lu.
 */
export default function robots(): MetadataRoute.Robots {
  const disallow = APP_PATH_PREFIXES.flatMap((prefix) => [`${prefix}$`, `${prefix}/`]);
  return {
    rules: [{ userAgent: '*', allow: '/', disallow }],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
