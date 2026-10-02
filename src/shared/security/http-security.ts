import type { HelmetOptions } from 'helmet';

/**
 * En-têtes de sécurité HTTP de l'API NestJS (Helmet).
 *
 * L'API ne sert que du JSON et l'interface Swagger (`/api/docs`). La CSP par
 * défaut de Helmet convient aux deux : Swagger UI charge ses scripts et sa
 * feuille de style depuis la même origine (aucun script inline) et n'utilise
 * que des styles inline et des images `data:`, déjà autorisés par les
 * directives par défaut. Vérifié par `src/shared/security/__tests__/http-security.spec.ts`.
 *
 * Écart volontaire avec les défauts Helmet :
 * - `upgrade-insecure-requests` retiré : l'API peut être servie en HTTP simple
 *   (dev local, première mise en service par IP avant le certificat Caddy) ;
 *   la directive ferait alors charger les ressources de Swagger en HTTPS et
 *   casserait la page. En production HTTPS, HSTS (Helmet) couvre déjà le besoin.
 * - `crossOriginEmbedderPolicy` désactivé (comportement existant conservé).
 */
export function apiHelmetOptions(): HelmetOptions {
  return {
    crossOriginEmbedderPolicy: false,
    contentSecurityPolicy: {
      useDefaults: true,
      directives: {
        upgradeInsecureRequests: null,
      },
    },
  };
}
