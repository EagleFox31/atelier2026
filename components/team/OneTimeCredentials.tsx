'use client';

import { useState } from 'react';
import { Check, Copy, ShieldAlert } from 'lucide-react';

/**
 * Identifiants temporaires affichés UNE SEULE FOIS (création d'un membre,
 * réinitialisation). Le mot de passe n'est stocké nulle part : s'il est perdu,
 * on en génère un nouveau. La personne devra le changer à sa première connexion.
 */
export function OneTimeCredentials({
  name,
  employeeCode,
  tempPassword,
  onDone,
  doneLabel = 'J’ai noté ces informations',
}: {
  name: string;
  employeeCode: string | null;
  tempPassword: string;
  onDone: () => void;
  doneLabel?: string;
}) {
  const [copied, setCopied] = useState<'code' | 'password' | null>(null);

  function copy(kind: 'code' | 'password', value: string) {
    void navigator.clipboard?.writeText(value);
    setCopied(kind);
    setTimeout(() => setCopied(null), 2000);
  }

  return (
    <div className="space-y-3" role="status" aria-live="polite">
      <div className="rounded-xl border border-slate-200 bg-slate-50 divide-y divide-slate-100 text-sm overflow-hidden">
        <div className="flex items-center justify-between px-4 py-2.5">
          <span className="text-slate-500">Membre</span>
          <span className="font-semibold">{name}</span>
        </div>
        {employeeCode && (
          <div className="flex items-center justify-between gap-2 px-4 py-2.5">
            <span className="text-slate-500">Identifiant</span>
            <span className="flex items-center gap-2">
              <span className="font-mono font-semibold text-brand">{employeeCode}</span>
              <button type="button" onClick={() => copy('code', employeeCode)} aria-label="Copier l’identifiant"
                className="text-slate-400 hover:text-brand">
                {copied === 'code' ? <Check size={14} className="text-green-500" /> : <Copy size={14} />}
              </button>
            </span>
          </div>
        )}
        <div className="flex items-center justify-between gap-2 px-4 py-2.5">
          <span className="text-slate-500">Mot de passe temporaire</span>
          <span className="flex items-center gap-2">
            <span className="font-mono font-semibold text-slate-800" data-testid="one-time-password">{tempPassword}</span>
            <button type="button" onClick={() => copy('password', tempPassword)} aria-label="Copier le mot de passe temporaire"
              className="text-slate-400 hover:text-brand">
              {copied === 'password' ? <Check size={14} className="text-green-500" /> : <Copy size={14} />}
            </button>
          </span>
        </div>
      </div>

      <p className="flex gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2 leading-relaxed">
        <ShieldAlert size={16} className="shrink-0 mt-0.5" aria-hidden />
        <span>
          Transmettez-le maintenant : il <strong>ne sera plus jamais affiché</strong>. À sa première connexion,
          la personne devra choisir son propre mot de passe. En cas d’oubli, générez-en un nouveau depuis Équipe.
        </span>
      </p>

      <button
        type="button"
        onClick={onDone}
        className="w-full h-10 rounded-lg bg-brand hover:bg-brand-hover text-white text-sm font-bold"
      >
        {doneLabel}
      </button>
    </div>
  );
}
