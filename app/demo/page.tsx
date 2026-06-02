import Link from 'next/link';
import { Wrench } from 'lucide-react';
import { DemoRequestForm } from '@/components/marketing/DemoRequestForm';
import { LandingKenteBar } from '@/components/marketing/LandingKenteBar';

export default function DemoPage() {
  return (
    <div className="landing-page min-h-screen bg-gradient-to-b from-[var(--afrique-sky)] via-[var(--afrique-sand)] to-white">
      <header className="sticky top-0 z-40 border-b border-[var(--afrique-gold)]/15 bg-white/85 backdrop-blur-xl">
        <LandingKenteBar />
        <div className="mx-auto flex max-w-lg items-center justify-between px-4 py-4 sm:px-6">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-brand/15 to-[var(--afrique-gold-soft)] ring-1 ring-[var(--afrique-gold)]/25">
              <Wrench className="text-brand" size={18} />
            </div>
            <span className="text-lg font-bold tracking-tight text-slate-800">
              Atelier <span className="text-brand">Maître</span>
            </span>
          </Link>
          <Link
            href="/login"
            className="text-sm font-medium text-[var(--afrique-earth)] hover:text-brand hover:underline"
          >
            Connexion
          </Link>
        </div>
      </header>

      <main className="px-4 py-10 sm:px-6 sm:py-14">
        <DemoRequestForm />
      </main>
    </div>
  );
}
