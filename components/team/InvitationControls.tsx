'use client';

import { useState } from 'react';
import { MailCheck, Send } from 'lucide-react';
import { toast } from 'sonner';
import { getApiErrorMessage, teamApi, type InvitationDelivery, type InvitationStatus } from '@/lib/api';
import { cn } from '@/lib/utils';

const BADGES: Partial<Record<InvitationStatus, { label: string; className: string }>> = {
  pending: { label: 'Invitation envoyée', className: 'bg-amber-100 text-amber-700' },
  expired: { label: 'Invitation expirée', className: 'bg-red-100 text-red-600' },
};

/** Badge de statut d'invitation (rien pour « none » et « accepted »). */
export function InvitationBadge({ status }: { status?: InvitationStatus }) {
  const badge = status ? BADGES[status] : undefined;
  if (!badge) return null;
  return (
    <span className={cn('text-[10px] font-semibold px-1.5 py-0.5 rounded-full', badge.className)}>
      {badge.label}
    </span>
  );
}

/** Message à afficher après un envoi d'invitation, selon le résultat réel de l'e-mail. */
export function invitationDeliveryMessage(delivery: InvitationDelivery): { ok: boolean; text: string } {
  if (delivery.emailStatus === 'sent') {
    return { ok: true, text: `Invitation envoyée à ${delivery.email}. Le lien est valable 72 heures.` };
  }
  return {
    ok: false,
    text:
      delivery.emailStatus === 'skipped'
        ? `L’e-mail n’a pas pu partir : l’envoi d’e-mails n’est pas configuré sur ce serveur. Générez plutôt un mot de passe temporaire depuis Équipe.`
        : `L’envoi de l’invitation à ${delivery.email} a échoué. Réessayez avec « Renvoyer l’invitation » ou générez un mot de passe temporaire.`,
  };
}

/** Bouton « Renvoyer l'invitation » (ADMIN) : nouveau lien, l'ancien devient invalide. */
export function ResendInvitationButton({
  memberId,
  memberName,
  onSent,
}: {
  memberId: string;
  memberName: string;
  onSent: () => void;
}) {
  const [sending, setSending] = useState(false);

  async function handleClick() {
    setSending(true);
    try {
      const delivery = await teamApi.resendInvitation(memberId);
      const { ok, text } = invitationDeliveryMessage(delivery);
      if (ok) toast.success(text);
      else toast.error(text);
      onSent();
    } catch (err) {
      toast.error(getApiErrorMessage(err, `Impossible de renvoyer l’invitation à ${memberName}`));
    } finally {
      setSending(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={sending}
      className="mt-1.5 inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-brand/20 bg-brand/5 px-2 py-1.5 text-[11px] font-medium text-brand hover:bg-brand/10 disabled:opacity-60"
    >
      <Send size={12} aria-hidden /> {sending ? 'Envoi…' : 'Renvoyer l’invitation'}
    </button>
  );
}

/** Confirmation affichée après la création d'un membre invité (aucun mot de passe). */
export function InvitationSent({
  name,
  employeeCode,
  delivery,
  onDone,
}: {
  name: string;
  employeeCode: string | null;
  delivery: InvitationDelivery;
  onDone: () => void;
}) {
  const { ok, text } = invitationDeliveryMessage(delivery);
  return (
    <div className="space-y-3" role="status" aria-live="polite">
      <div className="rounded-xl border border-slate-200 bg-slate-50 divide-y divide-slate-100 text-sm overflow-hidden">
        <div className="flex items-center justify-between px-4 py-2.5">
          <span className="text-slate-500">Membre</span>
          <span className="font-semibold">{name}</span>
        </div>
        {employeeCode && (
          <div className="flex items-center justify-between px-4 py-2.5">
            <span className="text-slate-500">Identifiant</span>
            <span className="font-mono font-semibold text-brand">{employeeCode}</span>
          </div>
        )}
      </div>
      <p
        className={cn(
          'flex gap-2 text-xs rounded-lg px-3 py-2 leading-relaxed border',
          ok ? 'text-green-700 bg-green-50 border-green-100' : 'text-amber-700 bg-amber-50 border-amber-100',
        )}
      >
        <MailCheck size={16} className="shrink-0 mt-0.5" aria-hidden />
        <span>
          {text}
          {ok && ' La personne choisira elle-même son mot de passe ; aucun mot de passe ne vous est communiqué.'}
        </span>
      </p>
      <button
        type="button"
        onClick={onDone}
        className="w-full h-10 rounded-lg bg-brand hover:bg-brand-hover text-white text-sm font-bold"
      >
        Terminer
      </button>
    </div>
  );
}
