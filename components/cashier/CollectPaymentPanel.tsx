'use client';

import { useEffect, useMemo, useState } from 'react';
import { Search, CheckCircle2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { billingApi, handleApiError } from '@/lib/api';
import { formatXAF, cn } from '@/lib/utils';
import { toast } from 'sonner';
import {
  CASHIER_PAYMENT_METHODS,
  customerDisplayName,
  invoiceBalance,
  isInvoiceCollectible,
  type CashierInvoice,
} from '@/lib/cashier';
import { MOBILE_BOTTOM_NAV_OFFSET } from '@/lib/constants';

interface CollectPaymentPanelProps {
  preselectedInvoiceId?: string | null;
  onPaymentSuccess?: () => void;
}

export function CollectPaymentPanel({ preselectedInvoiceId, onPaymentSuccess }: CollectPaymentPanelProps) {
  const [invoices, setInvoices] = useState<CashierInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(preselectedInvoiceId ?? null);
  const [paymentMethod, setPaymentMethod] = useState('CASH');
  const [paymentAmount, setPaymentAmount] = useState('');
  const [transactionRef, setTransactionRef] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function loadInvoices() {
    setLoading(true);
    try {
      const data = await billingApi.listInvoices() as CashierInvoice[];
      setInvoices(Array.isArray(data) ? data : []);
    } catch {
      toast.error('Impossible de charger les factures');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadInvoices();
  }, []);

  useEffect(() => {
    if (preselectedInvoiceId) setSelectedId(preselectedInvoiceId);
  }, [preselectedInvoiceId]);

  const collectible = useMemo(
    () => invoices.filter(isInvoiceCollectible),
    [invoices],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return collectible;
    return collectible.filter((inv) => {
      const name = customerDisplayName(inv.customer).toLowerCase();
      return (
        inv.reference?.toLowerCase().includes(q)
        || name.includes(q)
        || inv.serviceOrder?.reference?.toLowerCase().includes(q)
      );
    });
  }, [collectible, search]);

  const selected = collectible.find((inv) => inv.id === selectedId) ?? null;
  const balance = selected ? invoiceBalance(selected) : 0;
  const needsMobileRef = ['ORANGE_MONEY', 'MTN_MOBILE_MONEY'].includes(paymentMethod);

  useEffect(() => {
    if (selected) setPaymentAmount(String(Math.round(balance)));
  }, [selected?.id, balance]);

  async function handleSubmit() {
    if (!selected) {
      toast.error('Sélectionnez une facture');
      return;
    }
    const amount = Number(paymentAmount);
    if (!amount || amount <= 0) {
      toast.error('Montant invalide');
      return;
    }
    if (needsMobileRef && !transactionRef.trim()) {
      toast.error('Référence transaction requise');
      return;
    }

    setSubmitting(true);
    try {
      await billingApi.recordPayment({
        invoiceId: selected.id,
        amount,
        method: paymentMethod,
        transactionRef: transactionRef.trim() || undefined,
        idempotencyKey: `${selected.id}-${Date.now()}`,
      });
      toast.success(`Paiement de ${formatXAF(amount)} enregistré`);
      setTransactionRef('');
      setSelectedId(null);
      setPaymentAmount('');
      await loadInvoices();
      onPaymentSuccess?.();
    } catch (err: unknown) {
      handleApiError(err, 'Erreur lors de l\'encaissement');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pb-28 md:pb-0">
      <div className="space-y-3">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Réf. facture, client, OT…"
            className="pl-9 h-11 rounded-xl"
          />
        </div>

        <div className="space-y-2 max-h-[50vh] lg:max-h-[calc(100vh-16rem)] overflow-y-auto pr-1">
          {loading
            ? Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)
            : filtered.length === 0
              ? <p className="text-sm text-muted-foreground text-center py-10">Aucune facture à encaisser</p>
              : filtered.map((inv) => {
                const rest = invoiceBalance(inv);
                const active = selectedId === inv.id;
                return (
                  <button
                    key={inv.id}
                    type="button"
                    onClick={() => setSelectedId(inv.id)}
                    className={cn(
                      'w-full text-left p-3 rounded-xl border transition-colors',
                      active
                        ? 'border-brand bg-brand/5 ring-1 ring-brand/30'
                        : 'border-border bg-card hover:bg-muted/50',
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-[10px] text-muted-foreground">{inv.reference}</span>
                      <Badge className={cn(
                        'text-[9px] border-none',
                        inv.status === 'PARTIAL' ? 'bg-amber-500/20 text-amber-700' : 'bg-violet-500/20 text-violet-700',
                      )}>
                        {inv.status === 'PARTIAL' ? 'Partielle' : 'Emise'}
                      </Badge>
                    </div>
                    <p className="text-sm font-bold text-foreground truncate mt-1">{customerDisplayName(inv.customer)}</p>
                    <p className="text-xs text-amber-600 font-mono mt-1">Reste {formatXAF(rest)}</p>
                  </button>
                );
              })
          }
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card p-4 md:p-5 space-y-4 ring-1 ring-border/50 shadow-sm">
        {!selected ? (
          <p className="text-sm text-muted-foreground text-center py-16">Sélectionnez une facture à gauche</p>
        ) : (
          <>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider font-bold">Facture</p>
              <p className="font-mono text-sm font-bold mt-1">{selected.reference}</p>
              <p className="text-sm text-foreground mt-0.5">{customerDisplayName(selected.customer)}</p>
              <p className="text-2xl font-bold text-amber-600 font-mono mt-3">{formatXAF(balance)}</p>
              <p className="text-[11px] text-muted-foreground">Reste à payer</p>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Montant (XAF)</label>
              <Input
                type="number"
                inputMode="numeric"
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(e.target.value)}
                className="h-12 rounded-xl font-mono text-lg"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Mode</label>
              <Select value={paymentMethod} onValueChange={(v) => setPaymentMethod(v ?? 'CASH')}>
                <SelectTrigger className="h-11 rounded-xl w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CASHIER_PAYMENT_METHODS.map((m) => (
                    <SelectItem key={m.value} value={m.value}>
                      <div className="flex items-center gap-2">
                        <m.icon size={14} />
                        {m.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {needsMobileRef && (
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Référence transaction
                </label>
                <Input
                  value={transactionRef}
                  onChange={(e) => setTransactionRef(e.target.value)}
                  placeholder="Code SMS"
                  className="h-11 rounded-xl font-mono"
                />
              </div>
            )}
          </>
        )}
      </div>

      <div
        className="lg:hidden fixed left-0 right-0 z-[110] p-4 bg-card/95 backdrop-blur border-t border-border"
        style={{ bottom: MOBILE_BOTTOM_NAV_OFFSET }}
      >
        <Button
          className="w-full h-12 rounded-xl bg-brand hover:bg-brand-hover font-bold gap-2"
          disabled={!selected || submitting || !paymentAmount}
          onClick={handleSubmit}
        >
          <CheckCircle2 size={18} />
          {submitting ? 'Enregistrement…' : selected ? `Encaisser ${formatXAF(Number(paymentAmount) || 0)}` : 'Choisir une facture'}
        </Button>
      </div>

      <div className="hidden lg:block lg:col-span-2">
        <Button
          className="w-full h-11 rounded-xl bg-brand hover:bg-brand-hover font-bold"
          disabled={!selected || submitting || !paymentAmount || (needsMobileRef && !transactionRef.trim())}
          onClick={handleSubmit}
        >
          {submitting ? 'Enregistrement…' : 'Valider l\'encaissement'}
        </Button>
      </div>
    </div>
  );
}
