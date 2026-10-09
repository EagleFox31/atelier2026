'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { AlertTriangle, CheckCircle2, Clock, FileText, Loader2, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ApiError, getApiErrorMessage, publicQuotesApi, type PublicQuote } from '@/lib/api';
import { formatXAF } from '@/lib/utils';

type QuoteLinkErrorCode = 'QUOTE_LINK_INVALID' | 'QUOTE_LINK_EXPIRED' | 'QUOTE_ALREADY_DECIDED' | 'UNKNOWN';
type QuoteLinkError = { code: QuoteLinkErrorCode; message?: string };

const ERROR_SCREENS: Record<QuoteLinkErrorCode, { title: string; body: string; icon: typeof AlertTriangle }> = {
  QUOTE_LINK_INVALID: {
    title: 'Lien de devis invalide',
    body: 'Ce lien n’est pas (ou plus) valable. Vérifiez que vous avez ouvert le lien complet du dernier message reçu, ou contactez votre garage.',
    icon: AlertTriangle,
  },
  QUOTE_LINK_EXPIRED: {
    title: 'Lien expiré',
    body: 'Ce lien de devis n’est plus valable. Contactez votre garage pour en recevoir un nouveau.',
    icon: Clock,
  },
  QUOTE_ALREADY_DECIDED: {
    title: 'Réponse déjà enregistrée',
    body: 'Ce devis a déjà reçu une réponse. Contactez votre garage pour toute modification.',
    icon: CheckCircle2,
  },
  UNKNOWN: {
    title: 'Devis indisponible',
    body: 'Impossible d’afficher le devis pour le moment. Vérifiez votre connexion puis réessayez.',
    icon: AlertTriangle,
  },
};

function toError(err: unknown): QuoteLinkError {
  if (err instanceof ApiError && err.errorCode && err.errorCode in ERROR_SCREENS) {
    return { code: err.errorCode as QuoteLinkErrorCode, message: err.message };
  }
  return { code: 'UNKNOWN' };
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Africa/Douala' });
}

const STATUS_BANNERS: Partial<Record<PublicQuote['status'], { text: string; tone: string; icon: typeof CheckCircle2 }>> = {
  APPROVED: { text: 'Vous avez validé ce devis. Le garage a été prévenu.', tone: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300', icon: CheckCircle2 },
  BILLED: { text: 'Ce devis a été validé et facturé.', tone: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300', icon: CheckCircle2 },
  REJECTED: { text: 'Vous avez refusé ce devis. Le garage a été prévenu.', tone: 'border-border bg-muted text-muted-foreground', icon: XCircle },
  REVISED: { text: 'Ce devis a été remplacé par une nouvelle version.', tone: 'border-border bg-muted text-muted-foreground', icon: Clock },
};

export default function PublicQuotePage() {
  const params = useParams<{ token: string }>();
  const token = typeof params?.token === 'string' ? params.token : '';

  const [quote, setQuote] = useState<PublicQuote | null>(null);
  const [error, setError] = useState<QuoteLinkError | null>(null);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<'view' | 'reject'>('view');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState<'approve' | 'reject' | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setQuote(await publicQuotesApi.get(token));
    } catch (err) {
      setError(toError(err));
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  async function decide(decision: 'approve' | 'reject') {
    if (submitting) return;
    setSubmitting(decision);
    try {
      if (decision === 'approve') await publicQuotesApi.approve(token);
      else await publicQuotesApi.reject(token, reason.trim() || undefined);
      toast.success(decision === 'approve' ? 'Devis validé. Merci !' : 'Votre réponse a été transmise au garage.');
      setMode('view');
      await load();
    } catch (err) {
      const next = toError(err);
      if (next.code === 'UNKNOWN') toast.error(getApiErrorMessage(err, 'Impossible d’enregistrer votre réponse'));
      else setError(next);
    } finally {
      setSubmitting(null);
    }
  }

  return (
    <div className="min-h-screen bg-background px-4 py-8 flex justify-center">
      <div className="w-full max-w-xl space-y-6">
        <div className="flex flex-col items-center gap-3">
          <div className="w-14 h-14 rounded-2xl bg-brand flex items-center justify-center shadow-lg shadow-brand/30">
            <FileText className="text-white" size={26} />
          </div>
          <div className="text-center">
            <h1 className="text-2xl font-bold text-foreground tracking-tight">{quote?.garageName ?? 'Atelier Maître'}</h1>
            {quote && !error && <p className="text-sm text-muted-foreground mt-0.5">Devis {quote.reference}</p>}
          </div>
        </div>

        {loading && !quote ? (
          <div className="flex justify-center py-10" aria-live="polite">
            <Loader2 className="animate-spin text-brand" size={28} aria-label="Chargement du devis" />
          </div>
        ) : error ? (
          <QuoteLinkErrorCard error={error} onRetry={load} />
        ) : quote ? (
          <>
            <QuoteDetails quote={quote} />

            {STATUS_BANNERS[quote.status] && <StatusBanner status={quote.status} />}

            {quote.canDecide && mode === 'view' && (
              <div className="flex flex-col sm:flex-row gap-3">
                <Button
                  type="button"
                  className="flex-1 h-12 bg-brand hover:bg-brand-hover text-white font-bold"
                  disabled={submitting !== null}
                  onClick={() => void decide('approve')}
                >
                  {submitting === 'approve' ? <Loader2 size={16} className="animate-spin" /> : 'Valider le devis'}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1 h-12"
                  disabled={submitting !== null}
                  onClick={() => setMode('reject')}
                >
                  Refuser
                </Button>
              </div>
            )}

            {quote.canDecide && mode === 'reject' && (
              <Card className="bg-card border-border">
                <CardContent className="pt-6 space-y-3">
                  <Label htmlFor="reject-reason">Motif (facultatif)</Label>
                  <Textarea
                    id="reject-reason"
                    value={reason}
                    maxLength={500}
                    rows={3}
                    placeholder="Ex. : je préfère en discuter avec le garage"
                    onChange={(e) => setReason(e.target.value)}
                  />
                  <div className="flex flex-col sm:flex-row gap-3">
                    <Button
                      type="button"
                      variant="destructive"
                      className="flex-1 h-11"
                      disabled={submitting !== null}
                      onClick={() => void decide('reject')}
                    >
                      {submitting === 'reject' ? <Loader2 size={16} className="animate-spin" /> : 'Confirmer le refus'}
                    </Button>
                    <Button type="button" variant="ghost" className="flex-1 h-11" onClick={() => setMode('view')}>
                      Annuler
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {quote.canDecide && (
              <p className="text-xs text-muted-foreground text-center leading-relaxed">
                En validant, vous acceptez les travaux et le montant indiqués. Le garage est prévenu immédiatement.
              </p>
            )}
          </>
        ) : null}
      </div>
    </div>
  );
}

function QuoteDetails({ quote }: { quote: PublicQuote }) {
  return (
    <Card className="bg-card border-border ring-1 ring-border/50 shadow-xl">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg font-bold text-foreground">Bonjour {quote.customerName}</CardTitle>
        <CardDescription className="text-sm text-muted-foreground leading-relaxed">
          Devis du {formatDate(quote.issuedAt)}
          {quote.validUntil ? <>, valable jusqu’au {formatDate(quote.validUntil)}</> : null}
          {quote.vehicle ? (
            <>
              {' '}— véhicule <strong className="text-foreground">{quote.vehicle.plate}</strong>
              {quote.vehicle.label ? ` (${quote.vehicle.label})` : ''}
            </>
          ) : null}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <ul className="divide-y divide-border" aria-label="Lignes du devis">
          {quote.lines.map((line, index) => (
            <li key={index} className="py-2.5 flex items-start justify-between gap-3 text-sm">
              <div className="min-w-0">
                <p className="text-foreground break-words">{line.description || (line.lineType === 'PART' ? 'Pièce' : 'Main-d’œuvre')}</p>
                <p className="text-xs text-muted-foreground">
                  {line.quantity} × {formatXAF(line.unitPriceXaf)}
                  {line.discountPct > 0 ? ` — remise ${line.discountPct} %` : ''}
                </p>
              </div>
              <span className="font-medium text-foreground whitespace-nowrap">{formatXAF(line.lineTotalXaf)}</span>
            </li>
          ))}
        </ul>

        <dl className="space-y-1.5 text-sm border-t border-border pt-3">
          <Row label="Sous-total HT" value={formatXAF(quote.subtotalXaf)} />
          <Row label={`TVA (${(quote.taxRate * 100).toFixed(2).replace('.', ',')} %)`} value={formatXAF(quote.taxAmountXaf)} />
          {quote.stampDutyXaf > 0 && <Row label="Timbre" value={formatXAF(quote.stampDutyXaf)} />}
          <div className="flex justify-between items-baseline pt-2 border-t border-border">
            <dt className="font-semibold text-foreground">Total TTC</dt>
            <dd className="text-xl font-bold text-brand">{formatXAF(quote.totalXaf)}</dd>
          </div>
        </dl>

        {quote.notes && (
          <p className="text-sm text-muted-foreground whitespace-pre-line rounded-lg bg-muted px-3 py-2">{quote.notes}</p>
        )}
      </CardContent>
    </Card>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-muted-foreground">
      <dt>{label}</dt>
      <dd className="text-foreground">{value}</dd>
    </div>
  );
}

function StatusBanner({ status }: { status: PublicQuote['status'] }) {
  const banner = STATUS_BANNERS[status];
  if (!banner) return null;
  const Icon = banner.icon;
  return (
    <div role="status" className={`flex items-center gap-2 rounded-lg border px-4 py-3 text-sm ${banner.tone}`}>
      <Icon size={18} className="shrink-0" aria-hidden />
      {banner.text}
    </div>
  );
}

function QuoteLinkErrorCard({ error, onRetry }: { error: QuoteLinkError; onRetry: () => void }) {
  const screen = ERROR_SCREENS[error.code];
  const Icon = screen.icon;
  // Le serveur précise le motif d'expiration (lien remplacé, validité dépassée…).
  const body = error.code === 'QUOTE_LINK_EXPIRED' && error.message ? error.message : screen.body;
  return (
    <Card className="bg-card border-border ring-1 ring-border/50 shadow-xl" role="alert">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg font-bold text-foreground">
          <Icon size={20} className="text-brand shrink-0" aria-hidden />
          {screen.title}
        </CardTitle>
        <CardDescription className="text-sm text-muted-foreground leading-relaxed">{body}</CardDescription>
      </CardHeader>
      {error.code === 'UNKNOWN' && (
        <CardContent>
          <Button type="button" variant="outline" className="w-full" onClick={onRetry}>
            Réessayer
          </Button>
        </CardContent>
      )}
    </Card>
  );
}
