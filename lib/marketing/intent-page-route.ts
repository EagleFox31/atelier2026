import type { Metadata } from 'next';
import { INTENT_PAGES, type IntentPage } from '@/lib/marketing/intent-pages';
import { pageMetadata } from '@/lib/seo/metadata';

/** Contenu d'une page par intention ; échoue au build si le chemin n'est pas déclaré. */
export function intentPage(path: string): IntentPage {
  const page = INTENT_PAGES[path];
  if (!page) throw new Error(`Page publique inconnue : ${path} (lib/marketing/intent-pages.ts)`);
  return page;
}

export function intentPageMetadata(path: string): Metadata {
  const page = intentPage(path);
  return pageMetadata({ path, title: page.metaTitle, description: page.metaDescription });
}
