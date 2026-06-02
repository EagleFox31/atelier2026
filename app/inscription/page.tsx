import Link from 'next/link';
import { Wrench } from 'lucide-react';
import { LandingKenteBar } from '@/components/marketing/LandingKenteBar';
import { SignupWizard } from '@/components/signup/SignupWizard';

export default function InscriptionPage() {
  return (
    <div className="landing-page min-h-screen bg-gradient-to-b from-[var(--afrique-sky)] via-[var(--afrique-sand)] to-white">
      <header className="sticky top-0 z-40 border-b border-[var(--afrique-gold)]/15 bg-white/85 backdrop-blur-xl">
        <LandingKenteBar />
        <div className="mx-auto flex h-14 max-w-3xl items-center justify-between px-4 sm:px-6">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-brand/15 to-[var(--afrique-gold-soft)] ring-1 ring-[var(--afrique-gold)]/25">
              <Wrench className="text-brand" size={18} />
            </div>
            <span className="font-bold text-slate-800">Atelier Maître</span>
          </Link>
          <Link href="/login" className="text-sm font-medium text-brand hover:underline">
            Déjà un compte ?
          </Link>
        </div>
      </header>

      <main className="px-4 py-8 sm:px-6 sm:py-12">
        <div className="mx-auto mb-8 max-w-2xl text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--afrique-earth)]">
            Ouverture d&apos;atelier
          </p>
          <h1 className="mt-2 text-balance text-3xl font-bold tracking-tight text-slate-800 sm:text-4xl">
            Créez votre espace en{' '}
            <span className="landing-gradient-text">3 étapes</span>
          </h1>
          <p className="mx-auto mt-3 max-w-lg text-pretty text-slate-600">
            Administrateur, paramètres du garage et comptes équipe — prêt pour le terrain camerounais.
          </p>
        </div>
        <SignupWizard />
      </main>
    </div>
  );
}
