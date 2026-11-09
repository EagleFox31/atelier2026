import Link from 'next/link';
import { JsonLd } from '@/components/seo/JsonLd';
import { MarketingPageShell, MarketingSection } from '@/components/marketing/MarketingPageShell';
import { LANDING_COLORS as C } from '@/components/marketing/landing-colors';
import type { IntentPage } from '@/lib/marketing/intent-pages';
import { breadcrumbJsonLd } from '@/lib/seo/json-ld';
import { MARKETING_PAGES } from '@/lib/seo/site';

const LABELS = new Map(MARKETING_PAGES.map((page) => [page.path, page.label]));

/** Rendu serveur d'une page par intention de recherche (lib/marketing/intent-pages.ts). */
export function IntentPageView({ page }: { page: IntentPage }) {
  return (
    <MarketingPageShell eyebrow={page.eyebrow} title={page.h1} intro={page.intro}>
      <JsonLd data={breadcrumbJsonLd(page.path, LABELS.get(page.path) ?? page.h1)} />
      {page.sections.map((section) => (
        <MarketingSection key={section.title} title={section.title}>
          {section.paragraphs?.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
          {section.bullets ? (
            <ul className="list-disc space-y-1.5 pl-5">
              {section.bullets.map((bullet) => (
                <li key={bullet}>{bullet}</li>
              ))}
            </ul>
          ) : null}
        </MarketingSection>
      ))}
      <MarketingSection title="À lire aussi">
        <ul className="flex flex-wrap gap-3">
          {page.related.map((path) => (
            <li key={path}>
              <Link href={path} style={{ color: C.brand, fontWeight: 600 }}>
                {LABELS.get(path) ?? path}
              </Link>
            </li>
          ))}
        </ul>
      </MarketingSection>
    </MarketingPageShell>
  );
}
