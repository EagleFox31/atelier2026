'use client';

import Link from 'next/link';
import { ArrowRight, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { SectionEyebrow, SectionLead, SectionTitle } from '@/components/marketing/landing-ui';

const FLOW = ['Réception', 'OT', 'Devis', 'Travaux', 'Facture', 'Caisse'];

type Persona = {
  title: string;
  hint: string;
  href: string;
  cta: string;
  primary?: boolean;
};

const PERSONAS: Persona[] = [
  {
    title: 'Je lance mon garage',
    hint: 'Testez seul — pilote gratuit, sans carte.',
    href: '/inscription',
    cta: 'Créer mon atelier',
    primary: true,
  },
  {
    title: 'Plusieurs ateliers',
    hint: 'Réseau Douala, Yaoundé… tarif sur mesure.',
    href: '/demo',
    cta: 'Demander une démo',
    primary: true,
  },
  {
    title: 'Employé de l’atelier',
    hint: 'Technicien, réception, caisse — compte déjà créé.',
    href: '/login',
    cta: 'Se connecter',
  },
  {
    title: 'Je découvre',
    hint: 'Parcourir les modules avant de s’engager.',
    href: '#fonctionnalites',
    cta: 'Voir les fonctionnalités',
  },
];

function PersonaRow({ persona }: { persona: Persona }) {
  return (
    <div className="flex flex-col gap-3 border-b border-slate-200/90 py-5 last:border-0 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
      <div className="min-w-0">
        <p className="font-semibold text-slate-900">{persona.title}</p>
        <p className="mt-0.5 text-sm text-slate-500">{persona.hint}</p>
      </div>
      <Link
        href={persona.href}
        className={cn(
          'inline-flex shrink-0 items-center gap-1.5 text-sm font-medium transition-colors',
          persona.primary ? 'text-brand hover:text-brand/80' : 'text-slate-600 hover:text-brand',
        )}
      >
        {persona.cta}
        <ArrowRight size={14} aria-hidden />
      </Link>
    </div>
  );
}

export function LandingPersonaGuide() {
  return (
    <section
      id="par-ou-commencer"
      className="landing-band-muted scroll-mt-20 px-4 py-14 sm:px-6 sm:py-16"
      aria-labelledby="persona-guide-title"
    >
      <div className="mx-auto max-w-3xl">
        <div className="text-center">
          <SectionEyebrow>Votre profil</SectionEyebrow>
          <SectionTitle id="persona-guide-title">Par où commencer ?</SectionTitle>
          <SectionLead className="mx-auto mt-3 max-w-lg">
            Une entrée selon votre situation — le reste de la page détaille le produit.
          </SectionLead>
        </div>

        <p className="mt-8 text-center text-xs font-medium uppercase tracking-wider text-slate-400">
          Le fil d&apos;un véhicule dans l&apos;atelier
        </p>
        <div className="mt-3 flex flex-wrap items-center justify-center gap-x-1 gap-y-1 text-sm text-slate-600">
          {FLOW.map((step, i) => (
            <span key={step} className="inline-flex items-center gap-1">
              <span className="font-medium text-slate-800">{step}</span>
              {i < FLOW.length - 1 && (
                <span className="text-slate-300" aria-hidden>
                  →
                </span>
              )}
            </span>
          ))}
        </div>

        <div className="mt-10 rounded-xl border border-slate-200 bg-white px-5 sm:px-6">
          {PERSONAS.map((p) => (
            <PersonaRow key={p.title} persona={p} />
          ))}
        </div>
      </div>
    </section>
  );
}
