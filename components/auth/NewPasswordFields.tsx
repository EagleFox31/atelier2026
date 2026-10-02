'use client';

import { useState } from 'react';
import { Eye, EyeOff, ShieldCheck } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { PasswordStrengthIndicator } from '@/components/signup/PasswordStrengthIndicator';
import { cn } from '@/lib/utils';

/** Mêmes règles que la politique serveur (IsNewPassword : ChangePasswordDto, AcceptInvitationDto). */
export const NEW_PASSWORD_RULES = [
  { label: '10 caractères minimum', test: (p: string) => p.length >= 10 },
  { label: 'Au moins une lettre', test: (p: string) => /[A-Za-zÀ-ÿ]/.test(p) },
  { label: 'Au moins un chiffre', test: (p: string) => /\d/.test(p) },
];

/** Vrai si le nouveau mot de passe respecte les règles et que la confirmation correspond. */
export function isNewPasswordReady(next: string, confirm: string): boolean {
  return NEW_PASSWORD_RULES.every((r) => r.test(next)) && next.length > 0 && next === confirm;
}

export function PasswordField({
  id,
  label,
  value,
  onChange,
  autoComplete,
  disabled,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  autoComplete: string;
  disabled: boolean;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
        {label}
      </label>
      <div className="relative">
        <Input
          id={id}
          type={visible ? 'text' : 'password'}
          autoComplete={autoComplete}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          className="h-11 bg-muted border-border focus-visible:ring-brand pr-11"
          required
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? `Masquer : ${label}` : `Afficher : ${label}`}
          className="absolute right-0 top-0 flex h-11 w-11 items-center justify-center text-muted-foreground hover:text-foreground"
        >
          {visible ? <EyeOff size={18} /> : <Eye size={18} />}
        </button>
      </div>
    </div>
  );
}

/**
 * Saisie d'un nouveau mot de passe : champ + robustesse + règles + confirmation.
 * Partagé par le changement de mot de passe et l'activation d'un compte invité.
 */
export function NewPasswordFields({
  value,
  confirm,
  onChange,
  onConfirmChange,
  disabled,
  idPrefix = 'new',
  label = 'Nouveau mot de passe',
  confirmLabel = 'Confirmer le nouveau mot de passe',
}: {
  value: string;
  confirm: string;
  onChange: (v: string) => void;
  onConfirmChange: (v: string) => void;
  disabled: boolean;
  idPrefix?: string;
  label?: string;
  confirmLabel?: string;
}) {
  const matches = value.length > 0 && value === confirm;
  return (
    <>
      <div className="space-y-2">
        <PasswordField
          id={`${idPrefix}-password`}
          label={label}
          value={value}
          onChange={onChange}
          autoComplete="new-password"
          disabled={disabled}
        />
        <PasswordStrengthIndicator password={value} />
        <ul className="space-y-1 pt-1" aria-live="polite">
          {NEW_PASSWORD_RULES.map((rule) => {
            const ok = rule.test(value);
            return (
              <li
                key={rule.label}
                className={cn('flex items-center gap-2 text-xs', ok ? 'text-green-600' : 'text-muted-foreground')}
              >
                <ShieldCheck size={14} className={ok ? 'opacity-100' : 'opacity-40'} aria-hidden />
                {rule.label}
              </li>
            );
          })}
        </ul>
      </div>
      <PasswordField
        id={`${idPrefix}-password-confirm`}
        label={confirmLabel}
        value={confirm}
        onChange={onConfirmChange}
        autoComplete="new-password"
        disabled={disabled}
      />
      {confirm.length > 0 && !matches && (
        <p className="text-xs text-destructive" role="alert">Les deux mots de passe ne correspondent pas.</p>
      )}
    </>
  );
}
