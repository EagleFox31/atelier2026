'use client';

import Link from 'next/link';
import { AlertTriangle, CalendarClock, LockKeyhole } from 'lucide-react';
import type { SubscriptionSummary } from '@/lib/api';
import { cn } from '@/lib/utils';

function formatDate(value: string | null) {
  if (!value) return null;
  return new Date(value).toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
}

export function TrialStatusBanner({
  subscription,
}: {
  subscription: SubscriptionSummary;
}) {
  if (subscription.status === 'ACTIVE') return null;

  if (subscription.status === 'TRIAL') {
    const urgent = (subscription.daysRemaining ?? 30) <= 3;
    const endingSoon = (subscription.daysRemaining ?? 30) <= 7;
    const endDate = formatDate(subscription.trialEndsAt);

    return (
      <div
        className={cn(
          'border-b px-4 py-2.5 text-sm md:px-8',
          urgent
            ? 'border-red-200 bg-red-50 text-red-900'
            : endingSoon
              ? 'border-amber-200 bg-amber-50 text-amber-900'
              : 'border-brand/15 bg-brand/5 text-[var(--afrique-earth)]',
        )}
      >
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <CalendarClock className="h-4 w-4 shrink-0" />
            <span className="font-semibold">Pilote Pro</span>
            <span className="opacity-80">
              · {subscription.daysRemaining ?? '—'} jour
              {subscription.daysRemaining === 1 ? '' : 's'} restant
              {subscription.daysRemaining === 1 ? '' : 's'}
              {endDate ? ` · jusqu’au ${endDate}` : ''}
            </span>
          </div>
          {endingSoon && (
            <Link href="/#tarifs" className="font-semibold underline underline-offset-4">
              Voir les offres
            </Link>
          )}
        </div>
      </div>
    );
  }

  if (subscription.status === 'GRACE_PERIOD') {
    const graceEnd = formatDate(subscription.graceEndsAt);
    return (
      <div className="border-b border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950 md:px-8">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3">
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              <p className="font-semibold">Votre pilote de 30 jours est terminé.</p>
              <p className="text-xs opacity-80">
                L’atelier est en lecture seule
                {graceEnd ? ` jusqu’au ${graceEnd}` : ' pendant 7 jours'}.
              </p>
            </div>
          </div>
          <Link
            href="/#tarifs"
            className="rounded-lg bg-amber-900 px-3 py-1.5 text-xs font-semibold text-white"
          >
            Choisir une offre
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="border-b border-red-200 bg-red-50 px-4 py-3 text-sm text-red-950 md:px-8">
      <div className="mx-auto flex max-w-7xl items-center gap-2">
        <LockKeyhole className="h-4 w-4" />
        <span className="font-semibold">
          {subscription.status === 'SUSPENDED'
            ? 'Abonnement suspendu'
            : 'Pilote expiré'}
        </span>
      </div>
    </div>
  );
}
