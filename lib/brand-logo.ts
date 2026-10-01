/**
 * Marque Atelier Maître — affichée à la place du logo atelier quand celui-ci
 * n'est pas disponible (pilote, abonnement expiré, aucun logo envoyé).
 *
 * Source unique : `app/icon.tsx` (AppIconShell) rend le favicon PNG servi par
 * Next sur `/icon`. On le réutilise ici plutôt que de dupliquer un fichier image.
 */
export const BRAND_LOGO_URL = '/icon';
export const BRAND_NAME = 'Atelier Maître';

let brandLogoDataUrl: Promise<string | null> | null = null;

/**
 * Data URL PNG de la marque, pour jsPDF (qui exige une image déjà chargée).
 * Mis en cache ; `null` si le chargement échoue (le PDF garde alors un en-tête texte).
 */
export function loadBrandLogoDataUrl(): Promise<string | null> {
  if (typeof window === 'undefined') return Promise.resolve(null);

  brandLogoDataUrl ??= fetch(BRAND_LOGO_URL)
    .then((res) => (res.ok ? res.blob() : Promise.reject(new Error(`HTTP ${res.status}`))))
    .then(
      (blob) =>
        new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result));
          reader.onerror = () => reject(reader.error);
          reader.readAsDataURL(blob);
        }),
    )
    .catch(() => {
      brandLogoDataUrl = null; // nouvel essai au prochain appel
      return null;
    });

  return brandLogoDataUrl;
}
