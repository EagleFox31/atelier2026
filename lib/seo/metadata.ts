import type { Metadata } from 'next';
import { SITE_NAME, SITE_URL } from '@/lib/seo/site';

/** Métadonnées par défaut (layout racine) : base d'URL, Open Graph, Twitter. */
export const DEFAULT_METADATA: Metadata = {
  metadataBase: new URL(SITE_URL),
  openGraph: {
    type: 'website',
    siteName: SITE_NAME,
    locale: 'fr_FR',
  },
  twitter: { card: 'summary_large_image' },
};

/**
 * Métadonnées d'une page publique indexable : titre, description, canonical,
 * Open Graph et Twitter cohérents. `path` est relatif (`/tarifs`).
 */
export function pageMetadata({ path, title, description }: { path: string; title: string; description: string }): Metadata {
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: { ...DEFAULT_METADATA.openGraph, title, description, url: path },
    twitter: { card: 'summary_large_image', title, description },
  };
}
