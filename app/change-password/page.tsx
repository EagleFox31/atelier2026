'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { KeyRound, Loader2, LogOut } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { NewPasswordFields, PasswordField, isNewPasswordReady } from '@/components/auth/NewPasswordFields';
import { useAuth } from '@/contexts/auth-context';
import { ApiError, authApi, handleApiError } from '@/lib/api';
import { getDefaultHomeRoute } from '@/lib/role-routing';

export default function ChangePasswordPage() {
  const router = useRouter();
  const { user, setSessionFromToken, logout } = useAuth();
  const imposed = Boolean(user?.mustChangePassword);

  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const canSubmit = current.length > 0 && isNewPasswordReady(next, confirm) && !submitting;

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
              <NewPasswordFields
                value={next}
                confirm={confirm}
                onChange={setNext}
                onConfirmChange={setConfirm}
                disabled={submitting}
              />

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
