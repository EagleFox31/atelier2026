'use client';

import { useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { useApi } from '@/hooks/use-api';
import { billingApi } from '@/lib/api';
import { formatXAF } from '@/lib/utils';
import { toast } from 'sonner';

type InvoiceLike = {
  payments?: Array<{
    amountXaf?: number | string | null;
    method?: string | null;
    status?: string | null;
    paidAt?: string | null;
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
  const today = new Date().toISOString().split('T')[0];

  const { data, loading, refetch } = useApi(
    () => billingApi.listInvoices() as Promise<InvoiceLike[]>,
    [],
  );

  const confirmedToday = useMemo(() => {
    const invoices = Array.isArray(data) ? data : [];
    return invoices.flatMap((inv) =>
      (inv.payments ?? []).filter((p) => {
        if (p.status !== 'CONFIRMED' || !p.paidAt) return false;
        return new Date(p.paidAt).toISOString().split('T')[0] === today;
      }),
    );
  }, [data, today]);

  const totalsByMethod = useMemo(() => {
    const map = new Map<string, number>();
    for (const p of confirmedToday) {
      const key = p.method ?? 'AUTRE';
      map.set(key, (map.get(key) ?? 0) + Number(p.amountXaf || 0));
    }
    return map;
  }, [confirmedToday]);

  const totalCollected = useMemo(
    () => [...totalsByMethod.values()].reduce((a, b) => a + b, 0),
    [totalsByMethod],
  );

  const expectedCash = totalsByMethod.get('CASH') ?? 0;
  const countedCashNum = Number(countedCash || 0);
  const variance = countedCash ? countedCashNum - expectedCash : 0;

  function handleCloseDay() {
    const payload = {
      date: today,
      totalCollected,
      expectedCash,
      countedCash: countedCash ? countedCashNum : null,
      variance: countedCash ? variance : null,
      notes: notes.trim() || null,
      closedAt: new Date().toISOString(),
    };
    localStorage.setItem(`cashier-closure-${today}`, JSON.stringify(payload));
    toast.success('Clôture de caisse enregistrée localement');
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
                {[...totalsByMethod.entries()].map(([method, amount]) => (
                  <div key={method} className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">{METHOD_LABELS[method] ?? method}</span>
                    <span className="font-mono font-bold">{formatXAF(amount)}</span>
                  </div>
                ))}
                {totalsByMethod.size === 0 && (
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
              <Button className="flex-1 rounded-xl bg-brand hover:bg-brand-hover" onClick={handleCloseDay}>
                Clôturer
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
