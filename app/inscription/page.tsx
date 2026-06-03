import Link from 'next/link';
import { Wrench } from 'lucide-react';
import { LandingKenteBar } from '@/components/marketing/LandingKenteBar';
import { SignupWizard } from '@/components/signup/SignupWizard';

export default function InscriptionPage() {
  return (
    <div className="landing-page landing-auth-shell min-h-screen">
      <header className="sticky top-0 z-40 border-b border-[var(--afrique-brand-ring)] bg-[var(--afrique-surface)]/95 backdrop-blur-xl">
        <LandingKenteBar />
        <div className="mx-auto flex h-14 max-w-3xl items-center justify-between px-4 sm:px-6">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--afrique-brand-soft)] ring-1 ring-[var(--afrique-brand-ring)]">
              <Wrench className="text-brand" size={18} />
            </div>
            <span className="font-bold text-[var(--afrique-earth)]">
              Atelier <span className="text-brand">Maître</span>
            </span>
          </Link>
          <Link href="/login" className="text-sm font-medium text-brand hover:underline">
            Déjà un compte ?
          </Link>
        </div>
      </header>

      <main className="px-4 py-8 sm:px-6 sm:py-12">
        <div className="mx-auto mb-8 max-w-2xl text-center">
          <p className="text-xs font-bold uppercase tracking-[0.15em] text-brand">
            Ouverture d&apos;atelier
          </p>
          <h1 className="mt-2 text-balance text-3xl font-bold tracking-tight text-[var(--afrique-earth)] sm:text-4xl">
            Créez votre espace en{' '}
            <span className="landing-gradient-text">3 étapes</span>
          </h1>
          <p className="mx-auto mt-3 max-w-lg text-pretty text-[var(--afrique-earth-muted)]">
            Administrateur, paramètres du garage et comptes équipe — prêt pour le terrain camerounais.
          </p>
        </div>
        <SignupWizard />
      </main>
    </div>
  );
}
