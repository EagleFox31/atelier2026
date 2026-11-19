import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { LandingKenteBar } from '@/components/marketing/LandingKenteBar';
import { MarketingFooterLinks } from '@/components/marketing/MarketingFooterLinks';
import { LANDING_COLORS as C } from '@/components/marketing/landing-colors';

const HEADER_LINKS = [
  ['/logiciel-garage-cameroun', 'Le logiciel'],
  ['/tarifs', 'Tarifs'],
  ['/faq', 'FAQ'],
] as const;

/**
 * Gabarit des pages publiques prérendues (composant serveur, sans JS requis) :
 * en-tête, contenu, appel à l'action démo et maillage interne.
 */
export function MarketingPageShell({
  eyebrow,
  title,
  intro,
  children,
}: {
  eyebrow: string;
  title: string;
  intro: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen" style={{ background: C.surface, color: C.earth }}>
      <LandingKenteBar />
      <header className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-6">
        <Link href="/" className="text-lg font-bold" style={{ color: C.earth, textDecoration: 'none' }}>
          Atelier <span style={{ color: C.brand }}>Maître</span>
        </Link>
        <nav aria-label="Navigation principale" className="flex flex-wrap items-center gap-4 text-sm">
          {HEADER_LINKS.map(([href, label]) => (
            <Link key={href} href={href} style={{ color: C.muted, textDecoration: 'none' }}>
              {label}
            </Link>
          ))}
          <Link href="/login" style={{ color: C.brand, textDecoration: 'none', fontWeight: 600 }}>
            Connexion
          </Link>
        </nav>
      </header>

      <main className="mx-auto max-w-3xl px-4 pb-16 pt-8 sm:px-6">
        <p className="text-xs font-bold uppercase tracking-[0.12em]" style={{ color: C.brand }}>
          {eyebrow}
        </p>
        <h1 className="mt-2 text-3xl font-black leading-tight tracking-tight sm:text-4xl">{title}</h1>
        <p className="mt-4 text-lg leading-relaxed" style={{ color: C.muted }}>
          {intro}
        </p>

        <div className="marketing-prose mt-10 space-y-10">{children}</div>

        <section
          aria-labelledby="cta-demo"
          className="mt-14 rounded-2xl p-6 sm:p-8"
          style={{ background: C.earth, color: C.white }}
        >
          <h2 id="cta-demo" className="text-2xl font-bold">
            Voir Atelier Maître sur votre propre atelier
          </h2>
          <p className="mt-2" style={{ color: 'rgba(255,255,255,0.75)' }}>
            Une démonstration guidée, de l&apos;accueil du véhicule à l&apos;encaissement. Ou créez votre
            atelier et essayez-le vous-même.
          </p>
          <div className="mt-5 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/demo"
              className="inline-flex items-center justify-center gap-2 rounded-xl px-5 py-3 font-semibold"
              style={{ background: C.brand, color: C.white, textDecoration: 'none' }}
            >
              Réserver une démo <ArrowRight size={16} aria-hidden />
            </Link>
            <Link
              href="/inscription"
              className="inline-flex items-center justify-center rounded-xl px-5 py-3 font-semibold"
              style={{ border: '1px solid rgba(255,255,255,0.3)', color: C.white, textDecoration: 'none' }}
            >
              Créer mon atelier
            </Link>
          </div>
        </section>
      </main>

      <footer style={{ background: C.earth }} className="px-4 py-10 sm:px-6">
        <div className="mx-auto max-w-5xl text-center">
          <p className="font-bold" style={{ color: C.white }}>
            Atelier <span style={{ color: C.goldLight }}>Maître</span>
          </p>
          <MarketingFooterLinks />
          <p className="mt-6 text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>
            Un logiciel de{' '}
            <a href="https://www.trigenys.com" style={{ color: 'rgba(255,255,255,0.6)' }}>
              Trigenys Group
            </a>
          </p>
        </div>
      </footer>
    </div>
  );
}

/** Section titrée d'une page publique. */
export function MarketingSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="text-2xl font-bold tracking-tight">{title}</h2>
      <div className="mt-3 space-y-3 leading-relaxed" style={{ color: C.muted }}>
        {children}
      </div>
    </section>
  );
}
