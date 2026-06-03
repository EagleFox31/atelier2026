'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Menu, X } from 'lucide-react';
import { LandingKenteBar } from '@/components/marketing/LandingKenteBar';
import { LANDING_COLORS as C } from '@/components/marketing/landing-colors';

const NAV_LINKS = [
  ['#fonctionnalites', 'Fonctionnalités'],
  ['#demarrage', 'Démarrage'],
  ['#tarifs', 'Tarifs'],
  ['#faq', 'FAQ'],
] as const;

const btnOutline: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '0.5rem 1.25rem',
  borderRadius: 12,
  border: `1px solid ${C.brand}`,
  background: 'transparent',
  color: C.brand,
  fontWeight: 600,
  fontSize: '0.875rem',
  textDecoration: 'none',
  transition: 'background 0.2s, color 0.2s',
};

type LandingNavProps = {
  btnPrimary: React.CSSProperties;
};

export function LandingNav({ btnPrimary }: LandingNavProps) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="fixed top-0 left-0 right-0 z-[100]">
      <LandingKenteBar />
      <nav
        className="border-b border-[rgb(200_81_26/0.1)] bg-[#fdfaf4]/95 backdrop-blur-xl"
        aria-label="Navigation principale"
      >
        <div className="landing-inner landing-px flex h-14 min-h-14 items-center justify-between gap-3 sm:h-16">
          <Link
            href="/"
            className="shrink-0 font-[family-name:var(--font-playfair,Georgia,serif)] text-lg font-bold sm:text-xl"
            style={{ color: C.earth }}
            onClick={() => setMenuOpen(false)}
          >
            Atelier <span style={{ color: C.brand }}>Maître</span>
          </Link>

          <div className="hidden items-center gap-6 md:flex lg:gap-8">
            {NAV_LINKS.map(([href, label]) => (
              <Link
                key={href}
                href={href}
                className="text-sm font-medium transition-colors hover:opacity-80"
                style={{ color: C.muted, textDecoration: 'none' }}
              >
                {label}
              </Link>
            ))}
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <Link
              href="/login"
              className="hidden md:inline-flex hover:bg-[rgb(200_81_26/0.08)]"
              style={btnOutline}
            >
              Connexion
            </Link>
            <Link
              href="/demo"
              className="hidden md:inline-flex"
              style={{ ...btnPrimary, padding: '0.5rem 1.25rem', fontSize: '0.875rem', whiteSpace: 'nowrap' }}
            >
              Réserver une démo <ArrowRight size={14} />
            </Link>
            <button
              type="button"
              className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-[rgb(200_81_26/0.15)] bg-white md:hidden"
              aria-expanded={menuOpen}
              aria-controls="landing-mobile-menu"
              aria-label={menuOpen ? 'Fermer le menu' : 'Ouvrir le menu'}
              onClick={() => setMenuOpen((o) => !o)}
            >
              {menuOpen ? <X size={22} color={C.earth} /> : <Menu size={22} color={C.earth} />}
            </button>
          </div>
        </div>

        {menuOpen && (
          <div
            id="landing-mobile-menu"
            className="border-t border-[rgb(200_81_26/0.1)] bg-[#fdfaf4] px-4 py-4 md:hidden"
          >
            <div className="flex flex-col gap-1">
              {NAV_LINKS.map(([href, label]) => (
                <Link
                  key={href}
                  href={href}
                  className="rounded-lg px-3 py-2.5 text-sm font-medium"
                  style={{ color: C.earth, textDecoration: 'none' }}
                  onClick={() => setMenuOpen(false)}
                >
                  {label}
                </Link>
              ))}
              <Link
                href="/login"
                className="mt-2 inline-flex items-center justify-center rounded-xl py-3 text-sm font-semibold"
                style={{ ...btnOutline, width: '100%' }}
                onClick={() => setMenuOpen(false)}
              >
                Connexion
              </Link>
              <Link
                href="/demo"
                className="mt-2 inline-flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold text-white"
                style={{ ...btnPrimary, width: '100%', justifyContent: 'center' }}
                onClick={() => setMenuOpen(false)}
              >
                Réserver une démo <ArrowRight size={16} />
              </Link>
              <Link
                href="/inscription"
                className="inline-flex items-center justify-center rounded-lg px-3 py-2.5 text-sm font-medium"
                style={{ color: C.brand, textDecoration: 'none' }}
                onClick={() => setMenuOpen(false)}
              >
                Créer mon atelier
              </Link>
            </div>
          </div>
        )}
      </nav>
    </header>
  );
}
