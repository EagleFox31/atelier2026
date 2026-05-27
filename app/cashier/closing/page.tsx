'use client';

import { useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { useApi } from '@/hooks/use-api';
import { billingApi, handleApiError } from '@/lib/api';
import { formatXAF } from '@/lib/utils';
import { toast } from 'sonner';

type CashClosureSummary = {
  date: string;
  totalsByMethod: Record<string, number>;
  paymentCount: number;
  totalCollected: number;
  expectedCash: number;
  closures: Array<{
    id: string;
    performedAt: string;
    performedBy: string | null;
    metadata?: {
      countedCash?: number | null;
      variance?: number | null;
      notes?: string | null;
    };
  }>;
};

const METHOD_LABELS: Record<string, string> = {
  CASH: 'Espèces',
  ORANGE_MONEY: 'Orange Money',
  MTN_MOBILE_MONEY: 'MTN MoMo',
  BANK_TRANSFER: 'Virement',
  CHECK: 'Chèque',
};

export default function CashierClosingPage() {
  const [countedCash, setCountedCash] = useState('');
  const [notes, setNotes] = useState('');
  const [closing, setClosing] = useState(false);
  const today = new Date().toISOString().split('T')[0];

  const { data, loading, refetch } = useApi(
    () => billingApi.cashClosureSummary({ date: today }) as Promise<CashClosureSummary>,
    [today],
  );

  const totalsByMethod = useMemo(() => Object.entries(data?.totalsByMethod ?? {}), [data]);
  const totalCollected = Number(data?.totalCollected ?? 0);
  const expectedCash = Number(data?.expectedCash ?? 0);
  const countedCashNum = Number(countedCash || 0);
  const variance = countedCash ? countedCashNum - expectedCash : 0;

  async function handleCloseDay() {
    setClosing(true);
    try {
      await billingApi.closeCashDay({
        date: today,
        countedCash: countedCash ? countedCashNum : undefined,
        notes: notes.trim() || undefined,
      });
      toast.success('Clôture de caisse enregistrée');
      setNotes('');
      setCountedCash('');
      await refetch();
    } catch (err: unknown) {
      handleApiError(err, 'Impossible de clôturer la caisse');
    } finally {
      setClosing(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-foreground tracking-tight">Clôture de caisse</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Contrôle de fin de journée et écart de caisse.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 border-border ring-1 ring-border/50">
          <CardHeader>
            <CardTitle>Encaissements du jour</CardTitle>
            <CardDescription>{new Date().toLocaleDateString('fr-FR')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {loading ? (
              Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-8 rounded-md" />)
            ) : (
              <>
                {totalsByMethod.map(([method, amount]) => (
                  <div key={method} className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">{METHOD_LABELS[method] ?? method}</span>
                    <span className="font-mono font-bold">{formatXAF(amount)}</span>
                  </div>
                ))}
                {totalsByMethod.length === 0 && (
                  <p className="text-sm text-muted-foreground py-4 text-center">Aucun paiement confirmé aujourd&apos;hui</p>
                )}
              </>
            )}
            <Separator />
            <div className="flex items-center justify-between">
              <span className="font-semibold">Total encaissé</span>
              <span className="font-mono text-lg font-bold text-brand">{formatXAF(totalCollected)}</span>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border ring-1 ring-border/50">
          <CardHeader>
            <CardTitle>Contrôle espèces</CardTitle>
            <CardDescription>Vérification physique caisse</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1">
              <p className="text-xs uppercase tracking-wider text-muted-foreground font-bold">Espèces attendues</p>
              <p className="font-mono text-xl font-bold">{formatXAF(expectedCash)}</p>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs uppercase tracking-wider text-muted-foreground font-bold">Espèces comptées</label>
              <Input
                type="number"
                inputMode="numeric"
                value={countedCash}
                onChange={(e) => setCountedCash(e.target.value)}
                placeholder="Ex. 125000"
                className="h-11 rounded-xl font-mono"
              />
            </div>
            {countedCash && (
              <p className={`text-sm font-semibold ${variance === 0 ? 'text-green-600' : 'text-red-600'}`}>
                Ecart: {formatXAF(Math.abs(variance))} {variance === 0 ? '(OK)' : variance > 0 ? '(Surplus)' : '(Manque)'}
              </p>
            )}
            <div className="space-y-1.5">
              <label className="text-xs uppercase tracking-wider text-muted-foreground font-bold">Notes</label>
              <Input
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Incident, dépôt, remarque…"
                className="h-11 rounded-xl"
              />
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1 rounded-xl" onClick={() => refetch()}>
                Recharger
              </Button>
              <Button className="flex-1 rounded-xl bg-brand hover:bg-brand-hover" onClick={handleCloseDay} disabled={closing}>
                {closing ? 'Clôture…' : 'Clôturer'}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-border ring-1 ring-border/50">
        <CardHeader>
          <CardTitle>Historique des clôtures</CardTitle>
          <CardDescription>Dernières clôtures enregistrées pour la journée</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {loading ? (
            Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-14 rounded-lg" />)
          ) : (data?.closures?.length ?? 0) === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">Aucune clôture enregistrée pour cette date</p>
          ) : (
            data?.closures.map((closure) => {
              const meta = closure.metadata ?? {};
              const cVariance = Number(meta.variance ?? 0);
              return (
                <div key={closure.id} className="rounded-lg border border-border p-3 bg-card/60">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold">{closure.performedBy || 'Utilisateur'}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(closure.performedAt).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Compté: {meta.countedCash != null ? formatXAF(Number(meta.countedCash)) : '—'} ·
                    Ecart: {meta.variance != null ? ` ${formatXAF(Math.abs(cVariance))} ${cVariance === 0 ? '(OK)' : cVariance > 0 ? '(Surplus)' : '(Manque)'}` : ' —'}
                  </p>
                  {meta.notes ? <p className="text-xs text-muted-foreground mt-1">Note: {meta.notes}</p> : null}
                </div>
              );
            })
          )}
        </CardContent>
      </Card>
    </div>
  );
}
