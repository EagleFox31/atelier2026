import Link from 'next/link';
import { MARKETING_PAGES } from '@/lib/seo/site';

/** Maillage interne vers les pages publiques (lien crawlable dans le HTML serveur). */
export function MarketingFooterLinks() {
  return (
    <nav aria-label="Pages Atelier Maître" className="mt-6 flex flex-wrap justify-center gap-x-5 gap-y-2">
      {MARKETING_PAGES.filter((page) => page.path !== '/').map((page) => (
        <Link
          key={page.path}
          href={page.path}
          style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.55)', textDecoration: 'none' }}
        >
          {page.label}
        </Link>
      ))}
    </nav>
  );
}
