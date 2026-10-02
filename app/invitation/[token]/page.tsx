'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { AlertTriangle, Clock, Loader2, LogIn, MailCheck, UserCheck } from 'lucide-react';
import { toast } from 'sonner';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { NewPasswordFields, isNewPasswordReady } from '@/components/auth/NewPasswordFields';
import { useAuth } from '@/contexts/auth-context';
import { ApiError, getApiErrorMessage, invitationsApi, type PublicInvitation } from '@/lib/api';
import { getDefaultHomeRoute } from '@/lib/role-routing';

type InvitationErrorCode = 'INVITATION_INVALID' | 'INVITATION_EXPIRED' | 'INVITATION_USED' | 'UNKNOWN';

const ERROR_SCREENS: Record<InvitationErrorCode, { title: string; body: string; icon: typeof AlertTriangle }> = {
  INVITATION_INVALID: {
    title: 'Lien d’invitation invalide',
    body: 'Ce lien n’est pas (ou plus) valable. Vérifiez que vous avez ouvert le lien complet du dernier e-mail reçu, ou demandez une nouvelle invitation à l’administrateur de votre atelier.',
    icon: AlertTriangle,
  },
  INVITATION_EXPIRED: {
    title: 'Invitation expirée',
    body: 'Les invitations sont valables 72 heures. Demandez à l’administrateur de votre atelier de vous en renvoyer une depuis la page Équipe.',
    icon: Clock,
  },
  INVITATION_USED: {
    title: 'Compte déjà activé',
    body: 'Cette invitation a déjà servi. Connectez-vous avec votre e-mail ou votre identifiant et le mot de passe que vous avez choisi.',
    icon: UserCheck,
  },
  UNKNOWN: {
    title: 'Invitation indisponible',
    body: 'Impossible de vérifier votre invitation pour le moment. Vérifiez votre connexion puis réessayez.',
    icon: AlertTriangle,
  },
};

function toErrorCode(err: unknown): InvitationErrorCode {
  if (err instanceof ApiError && err.errorCode && err.errorCode in ERROR_SCREENS) {
    return err.errorCode as InvitationErrorCode;
  }
  return 'UNKNOWN';
}

function formatExpiry(iso: string): string {
  const date = new Date(iso);
  return `${date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', timeZone: 'Africa/Douala' })} à ${date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Douala' })}`;
}

export default function InvitationPage() {
  const router = useRouter();
  const params = useParams<{ token: string }>();
  const token = typeof params?.token === 'string' ? params.token : '';
  const { setSessionFromToken } = useAuth();

  const [invitation, setInvitation] = useState<PublicInvitation | null>(null);
  const [error, setError] = useState<InvitationErrorCode | null>(null);
  const [loading, setLoading] = useState(true);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setInvitation(await invitationsApi.get(token));
    } catch (err) {
      setError(toErrorCode(err));
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  const canSubmit = isNewPasswordReady(password, confirm) && !submitting;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      const { access_token } = await invitationsApi.accept(token, password);
      const profile = await setSessionFromToken(access_token);
      toast.success('Compte activé. Bienvenue dans votre atelier !');
      router.replace(getDefaultHomeRoute(profile));
    } catch (err) {
      const code = toErrorCode(err);
      if (code === 'UNKNOWN') {
        toast.error(getApiErrorMessage(err, 'Impossible d’activer le compte'));
      } else {
        setError(code);
      }
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="flex flex-col items-center gap-3">
          <div className="w-14 h-14 rounded-2xl bg-brand flex items-center justify-center shadow-lg shadow-brand/30">
            <MailCheck className="text-white" size={26} />
          </div>
          <div className="text-center">
            <h1 className="text-2xl font-bold text-foreground tracking-tight">Atelier Maître</h1>
            {invitation?.workshopName && !error && (
              <p className="text-sm text-muted-foreground mt-0.5">{invitation.workshopName}</p>
            )}
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-10" aria-live="polite">
            <Loader2 className="animate-spin text-brand" size={28} aria-label="Vérification de l’invitation" />
          </div>
        ) : error ? (
          <InvitationError code={error} onRetry={load} />
        ) : invitation ? (
          <Card className="bg-card border-border ring-1 ring-border/50 shadow-xl">
            <CardHeader className="pb-4">
              <CardTitle className="text-lg font-bold text-foreground">
                Bienvenue, {invitation.firstName}&nbsp;!
              </CardTitle>
              <CardDescription className="text-xs text-muted-foreground leading-relaxed">
                Choisissez votre mot de passe pour activer votre compte
                {invitation.workshopName ? <> chez <strong>{invitation.workshopName}</strong></> : null}.
                Ce lien expire le {formatExpiry(invitation.expiresAt)}.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                {invitation.employeeCode && (
                  <div className="flex items-center justify-between rounded-lg border border-border bg-muted px-3 py-2 text-sm">
                    <span className="text-muted-foreground">Votre identifiant</span>
                    <span className="font-mono font-semibold text-brand">{invitation.employeeCode}</span>
                  </div>
                )}
                <NewPasswordFields
                  idPrefix="invitation"
                  label="Mot de passe"
                  confirmLabel="Confirmer le mot de passe"
                  value={password}
                  confirm={confirm}
                  onChange={setPassword}
                  onConfirmChange={setConfirm}
                  disabled={submitting}
                />
                <Button
                  type="submit"
                  className="w-full h-11 bg-brand hover:bg-brand-hover text-white font-bold rounded-lg shadow-md shadow-brand/20"
                  disabled={!canSubmit}
                >
                  {submitting ? <Loader2 size={16} className="animate-spin" /> : 'Activer mon compte'}
                </Button>
              </form>
            </CardContent>
          </Card>
        ) : null}
      </div>
    </div>
  );
}

function InvitationError({ code, onRetry }: { code: InvitationErrorCode; onRetry: () => void }) {
  const screen = ERROR_SCREENS[code];
  const Icon = screen.icon;
  return (
    <Card className="bg-card border-border ring-1 ring-border/50 shadow-xl" role="alert">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg font-bold text-foreground">
          <Icon size={20} className="text-brand shrink-0" aria-hidden />
          {screen.title}
        </CardTitle>
        <CardDescription className="text-sm text-muted-foreground leading-relaxed">{screen.body}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {code === 'UNKNOWN' && (
          <Button type="button" variant="outline" className="w-full" onClick={onRetry}>
            Réessayer
          </Button>
        )}
        <Link href="/login" className={buttonVariants({ className: 'w-full gap-2 bg-brand hover:bg-brand-hover text-white' })}>
          <LogIn size={16} aria-hidden /> Aller à la connexion
        </Link>
      </CardContent>
    </Card>
  );
}
