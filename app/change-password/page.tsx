'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff, KeyRound, Loader2, LogOut, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { PasswordStrengthIndicator } from '@/components/signup/PasswordStrengthIndicator';
import { useAuth } from '@/contexts/auth-context';
import { ApiError, authApi, handleApiError } from '@/lib/api';
import { getDefaultHomeRoute } from '@/lib/role-routing';
import { cn } from '@/lib/utils';

/** Mêmes règles que ChangePasswordDto côté API. */
const RULES = [
  { label: '10 caractères minimum', test: (p: string) => p.length >= 10 },
  { label: 'Au moins une lettre', test: (p: string) => /[A-Za-zÀ-ÿ]/.test(p) },
  { label: 'Au moins un chiffre', test: (p: string) => /\d/.test(p) },
];

function PasswordField({
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

export default function ChangePasswordPage() {
  const router = useRouter();
  const { user, setSessionFromToken, logout } = useAuth();
  const imposed = Boolean(user?.mustChangePassword);

  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const rulesOk = RULES.every((r) => r.test(next));
  const matches = next.length > 0 && next === confirm;
  const canSubmit = current.length > 0 && rulesOk && matches && !submitting;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      const { access_token } = await authApi.changePassword(current, next);
      const profile = await setSessionFromToken(access_token);
      toast.success('Mot de passe mis à jour. Vos autres sessions ont été déconnectées.');
      router.replace(getDefaultHomeRoute(profile));
    } catch (err) {
      if (err instanceof ApiError && err.errorCode === 'CURRENT_PASSWORD_INVALID') {
        toast.error(imposed ? 'Le mot de passe temporaire est incorrect.' : 'Le mot de passe actuel est incorrect.');
      } else {
        handleApiError(err, 'Impossible de changer le mot de passe');
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function handleLogout() {
    await logout();
    router.replace('/login');
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="flex flex-col items-center gap-3">
          <div className="w-14 h-14 rounded-2xl bg-brand flex items-center justify-center shadow-lg shadow-brand/30">
            <KeyRound className="text-white" size={26} />
          </div>
          <div className="text-center">
            <h1 className="text-2xl font-bold text-foreground tracking-tight">Atelier Maître</h1>
            {user && (
              <p className="text-sm text-muted-foreground mt-0.5">
                {user.firstName} {user.lastName}
              </p>
            )}
          </div>
        </div>

        <Card className="bg-card border-border ring-1 ring-border/50 shadow-xl">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg font-bold text-foreground">
              {imposed ? 'Choisissez votre mot de passe' : 'Changer mon mot de passe'}
            </CardTitle>
            <CardDescription className="text-xs text-muted-foreground leading-relaxed">
              {imposed
                ? 'Pour votre sécurité, remplacez le mot de passe temporaire qui vous a été communiqué. Il ne fonctionnera plus ensuite.'
                : 'Vos autres sessions ouvertes seront déconnectées.'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <PasswordField
                id="current-password"
                label={imposed ? 'Mot de passe temporaire' : 'Mot de passe actuel'}
                value={current}
                onChange={setCurrent}
                autoComplete="current-password"
                disabled={submitting}
              />
              <div className="space-y-2">
                <PasswordField
                  id="new-password"
                  label="Nouveau mot de passe"
                  value={next}
                  onChange={setNext}
                  autoComplete="new-password"
                  disabled={submitting}
                />
                <PasswordStrengthIndicator password={next} />
                <ul className="space-y-1 pt-1" aria-live="polite">
                  {RULES.map((rule) => {
                    const ok = rule.test(next);
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
                id="confirm-password"
                label="Confirmer le nouveau mot de passe"
                value={confirm}
                onChange={setConfirm}
                autoComplete="new-password"
                disabled={submitting}
              />
              {confirm.length > 0 && !matches && (
                <p className="text-xs text-destructive" role="alert">Les deux mots de passe ne correspondent pas.</p>
              )}

              <Button
                type="submit"
                className="w-full h-11 bg-brand hover:bg-brand-hover text-white font-bold rounded-lg shadow-md shadow-brand/20"
                disabled={!canSubmit}
              >
                {submitting ? <Loader2 size={16} className="animate-spin" /> : 'Enregistrer mon mot de passe'}
              </Button>

              <button
                type="button"
                onClick={handleLogout}
                className="w-full inline-flex items-center justify-center gap-1.5 pt-1 text-xs text-muted-foreground hover:text-foreground hover:underline"
              >
                <LogOut size={14} /> Se déconnecter
              </button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
