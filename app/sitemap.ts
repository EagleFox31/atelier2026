import type { MetadataRoute } from 'next';
import { MARKETING_PAGES, absoluteUrl } from '@/lib/seo/site';

/** Sitemap des seules pages publiques indexables (lib/seo/site.ts). */
export default function sitemap(): MetadataRoute.Sitemap {
  return MARKETING_PAGES.map((page) => ({
    url: absoluteUrl(page.path),
    changeFrequency: page.changeFrequency,
    priority: page.priority,
  }));
}
