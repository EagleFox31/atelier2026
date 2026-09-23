'use client';

import Link from 'next/link';
import { LockKeyhole, ShieldCheck } from 'lucide-react';
import type { SubscriptionSummary } from '@/lib/api';
import { Button } from '@/components/ui/button';

function formatDate(value: string | null) {
  if (!value) return null;
  return new Date(value).toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
}

export function SubscriptionBlockedScreen({
  subscription,
  onLogout,
}: {
  subscription: SubscriptionSummary;
  onLogout: () => void | Promise<void>;
}) {
  const retentionEnd = formatDate(subscription.dataRetentionEndsAt);
  const suspended = subscription.status === 'SUSPENDED';

  return (
    <div className="min-h-screen bg-[var(--afrique-sand)] px-4 py-12">
      <div className="mx-auto max-w-xl overflow-hidden rounded-3xl border border-[var(--afrique-brand-ring)] bg-white shadow-xl shadow-black/5">
        <div className="h-1.5 bg-gradient-to-r from-brand via-[var(--afrique-gold)] to-[var(--afrique-forest)]" />
        <div className="p-7 text-center sm:p-10">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--afrique-brand-soft)] text-brand">
            <LockKeyhole className="h-8 w-8" />
          </div>
          <p className="mt-6 text-xs font-bold uppercase tracking-[0.16em] text-brand">
            {suspended ? 'Abonnement suspendu' : 'Pilote terminé'}
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-[var(--afrique-earth)]">
            {suspended
              ? 'Votre espace est temporairement suspendu.'
              : 'Vos 30 jours de pilote sont arrivés à leur terme.'}
          </h1>
          <p className="mx-auto mt-4 max-w-md text-sm leading-relaxed text-[var(--afrique-earth-muted)]">
            {suspended
              ? 'Contactez-nous pour régulariser votre accès à Atelier Maître.'
              : 'Choisissez une offre pour reprendre les créations et modifications dans votre atelier.'}
          </p>

          {!suspended && (
            <div className="mx-auto mt-6 flex max-w-md items-start gap-3 rounded-2xl bg-[var(--afrique-forest-soft)] p-4 text-left">
              <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-[var(--afrique-forest)]" />
              <p className="text-sm text-[var(--afrique-earth)]">
                Vos données sont intactes
                {retentionEnd ? ` et conservées jusqu’au ${retentionEnd}` : ''}.
              </p>
            </div>
          )}

          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
            <Button asChild className="landing-auth-btn-primary h-11 rounded-xl px-6">
              <Link href="/#tarifs">Voir les offres</Link>
            </Button>
            <Button variant="outline" className="h-11 rounded-xl px-6" onClick={() => void onLogout()}>
              Se déconnecter
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
