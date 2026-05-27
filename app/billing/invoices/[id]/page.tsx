'use client';

import React, { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ArrowLeft, Printer, Download, CreditCard, Receipt, CheckCircle2, Clock, AlertCircle, Car, User, Banknote, Smartphone } from "lucide-react";
import { billingApi, settingsApi } from "@/lib/api";
import { useApi } from "@/hooks/use-api";
import { formatXAF, cn } from "@/lib/utils";
import { toast } from "sonner";
import { handleApiError } from "@/lib/api";
import { useAuth } from "@/contexts/auth-context";
import { BillingDocument } from "@/components/billing/BillingDocument";
import { buildInvoicePrintData } from "@/lib/billing-print-data";
import { FALLBACK_WORKSHOP_SETTINGS } from "@/lib/workshop-settings";

const INVOICE_STATUS: Record<string, { label: string; color: string }> = {
  DRAFT:     { label: 'Brouillon',         color: 'bg-slate-100 text-slate-600' },
  ISSUED:    { label: 'Émise',             color: 'bg-blue-50 text-blue-700' },
  PARTIAL:   { label: 'Partiellement payée', color: 'bg-amber-50 text-amber-700' },
  PAID:      { label: 'Payée',             color: 'bg-green-50 text-green-700' },
  DISPUTED:  { label: 'Contestée',         color: 'bg-orange-50 text-orange-700' },
  CANCELLED: { label: 'Annulée',           color: 'bg-red-50 text-red-600' },
};

const PAYMENT_METHODS = [
  { value: 'CASH',             label: 'Espèces',          icon: Banknote },
  { value: 'ORANGE_MONEY',     label: 'Orange Money',     icon: Smartphone },
  { value: 'MTN_MOBILE_MONEY', label: 'MTN MoMo',         icon: Smartphone },
  { value: 'BANK_TRANSFER',    label: 'Virement bancaire', icon: CreditCard },
  { value: 'CHECK',            label: 'Chèque',           icon: CreditCard },
];

function customerName(c: any) {
  if (!c) return '—';
  return c.customerType === 'COMPANY'
    ? c.companyName
    : [c.firstName, c.lastName].filter(Boolean).join(' ');
}

export default function InvoiceDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const { hasPermission } = useAuth();

  const [isPaymentOpen, setIsPaymentOpen]   = useState(false);
  const [paymentMethod, setPaymentMethod]   = useState('CASH');
  const [paymentAmount, setPaymentAmount]   = useState('');
  const [transactionRef, setTransactionRef] = useState('');
  const [paymentLoading, setPaymentLoading] = useState(false);

  const { data: invoice, loading, refetch } = useApi(
    () => billingApi.getInvoice(id) as Promise<any>,
    [id]
  );

  const { data: workshop } = useApi(
    () => settingsApi.getWorkshop().catch(() => FALLBACK_WORKSHOP_SETTINGS),
    [],
  );

  // Pré-remplir le montant quand la facture est chargée
  React.useEffect(() => {
    if (invoice?.balanceXaf) setPaymentAmount(String(Math.round(Number(invoice.balanceXaf))));
  }, [invoice]);

  async function handlePayment() {
    const amount = Number(paymentAmount);
    if (!amount || amount <= 0) { toast.error('Montant invalide'); return; }
    setPaymentLoading(true);
    try {
      await billingApi.recordPayment({
        invoiceId: id,
        amount,
        method: paymentMethod,
        transactionRef: transactionRef || undefined,
        idempotencyKey: `${id}-${Date.now()}`,
      });
      toast.success(`Paiement de ${formatXAF(amount)} enregistré`);
      setIsPaymentOpen(false);
      setTransactionRef('');
      refetch();
    } catch (err: unknown) {
      handleApiError(err, 'Erreur lors de l\'enregistrement');
    } finally {
      setPaymentLoading(false);
    }
  }

  if (loading) return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Skeleton className="w-10 h-10 rounded-full" />
        <div className="space-y-2"><Skeleton className="h-7 w-48" /><Skeleton className="h-4 w-32" /></div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
        <Skeleton className="h-28 rounded-xl" />
        <Skeleton className="h-28 rounded-xl" />
        <Skeleton className="h-28 rounded-xl hidden md:block" />
      </div>
      <Skeleton className="h-72 rounded-xl" />
    </div>
  );

  if (!invoice) return (
    <div className="flex flex-col items-center justify-center py-20 gap-4">
      <AlertCircle size={48} className="text-red-500" />
      <h2 className="text-xl font-bold text-foreground">Facture introuvable</h2>
      <Button variant="link" onClick={() => router.push('/billing')}>Retour</Button>
    </div>
  );

  const st = INVOICE_STATUS[invoice.status] ?? { label: invoice.status, color: '' };
  const lines: any[]    = invoice.lines    || [];
  const payments: any[] = invoice.payments || [];
  const isPaid   = invoice.status === 'PAID';
  const balance  = Number(invoice.balanceXaf);
  const canPay   = !isPaid && invoice.status !== 'CANCELLED' && hasPermission('FAC_PAY');
  const needsMobileRef = ['ORANGE_MONEY', 'MTN_MOBILE_MONEY'].includes(paymentMethod);

  const paymentDialog = (
    <Dialog open={isPaymentOpen} onOpenChange={setIsPaymentOpen}>
      <DialogContent className="w-[calc(100%-2rem)] max-w-[440px] bg-card border-border">
        <DialogHeader>
          <DialogTitle>Enregistrer un paiement</DialogTitle>
          <p className="text-sm text-muted-foreground">
            Reste à payer : <span className="font-bold text-amber-600">{formatXAF(balance)}</span>
          </p>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Montant (XAF)
            </label>
            <Input
              type="number"
              inputMode="numeric"
              placeholder={String(Math.round(balance))}
              value={paymentAmount}
              onChange={e => setPaymentAmount(e.target.value)}
              className="bg-muted border-border font-mono text-lg h-12"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Mode de paiement
            </label>
            <Select value={paymentMethod} onValueChange={v => setPaymentMethod(v ?? 'CASH')}>
              <SelectTrigger className="bg-muted border-border h-11">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PAYMENT_METHODS.map(m => (
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
                Référence transaction <span className="text-red-500">*</span>
              </label>
              <Input
                placeholder="Ex: CM2026052512345"
                value={transactionRef}
                onChange={e => setTransactionRef(e.target.value)}
                className="bg-muted border-border font-mono h-11"
              />
              <p className="text-[11px] text-muted-foreground">
                Code reçu par SMS après confirmation du paiement mobile
              </p>
            </div>
          )}
          <Button
            className="w-full bg-brand hover:bg-brand-hover h-11"
            onClick={handlePayment}
            disabled={paymentLoading || !paymentAmount || (needsMobileRef && !transactionRef.trim())}
          >
            {paymentLoading ? 'Enregistrement...' : `Valider · ${formatXAF(Number(paymentAmount) || 0)}`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );

  return (
    <>
    <div className={cn('space-y-6 print-hide', canPay && 'pb-28 md:pb-0')}>
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3 min-w-0">
          <Button variant="ghost" size="icon" onClick={() => router.back()} className="shrink-0 mt-0.5">
            <ArrowLeft size={20} />
          </Button>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-bold text-foreground font-mono truncate">{invoice.reference}</h1>
              <Badge className={cn('font-bold border-none shrink-0', st.color)}>{st.label}</Badge>
            </div>
            <div className="text-muted-foreground text-xs sm:text-sm mt-1 space-y-0.5">
              <p>
                Émise le {invoice.issuedAt ? new Date(invoice.issuedAt).toLocaleDateString('fr-FR') : '—'}
                {invoice.dueDate && <> · Échéance {new Date(invoice.dueDate).toLocaleDateString('fr-FR')}</>}
              </p>
              {invoice.serviceOrder && (
                <p>OT <span className="font-mono">{invoice.serviceOrder.reference}</span></p>
              )}
            </div>
          </div>
        </div>
        <div className="flex gap-2 print-hide pl-12 sm:pl-0 shrink-0">
          <Button
            variant="outline"
            size="sm"
            className="gap-2 border-border rounded-xl"
            onClick={() => router.push(`/billing/invoices/${id}/print`)}
          >
            <Printer size={16} />
            <span className="hidden sm:inline">Imprimer / PDF</span>
          </Button>
          {canPay && (
            <Button
              className="bg-brand hover:bg-brand-hover gap-2 rounded-xl hidden md:inline-flex"
              onClick={() => setIsPaymentOpen(true)}
            >
              <CreditCard size={16} />
              Enregistrer un paiement
            </Button>
          )}
        </div>
      </div>

      {/* Solde — bandeau mobile prioritaire */}
      <Card className={cn(
        'border-border shadow-sm md:hidden',
        isPaid ? 'border-green-200 bg-green-50/50' : 'border-amber-200 bg-amber-50/40',
      )}>
        <CardContent className="p-4 flex items-center justify-between gap-4">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Reste à payer</p>
            <p className={cn('text-2xl font-bold font-mono mt-0.5', isPaid ? 'text-green-600' : 'text-amber-600')}>
              {formatXAF(balance)}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Total {formatXAF(invoice.totalXaf)} · Payé {formatXAF(invoice.amountPaidXaf)}
            </p>
          </div>
          {isPaid ? (
            <CheckCircle2 size={32} className="text-green-600 shrink-0" />
          ) : (
            <Clock size={32} className="text-amber-500 shrink-0" />
          )}
        </CardContent>
      </Card>

      {/* Infos */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
        <Card className="border-border shadow-sm">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1"><User size={14} /> Client</CardDescription>
            <CardTitle className="text-base sm:text-lg leading-tight">{customerName(invoice.customer)}</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-1">
            {invoice.customer?.phonePrimary && (
              <a href={`tel:${invoice.customer.phonePrimary.replace(/\s/g, '')}`} className="hover:text-foreground">
                {invoice.customer.phonePrimary}
              </a>
            )}
            {invoice.customer?.city && <p>{invoice.customer.city}</p>}
          </CardContent>
        </Card>

        <Card className="border-border shadow-sm">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1"><Car size={14} /> OT associé</CardDescription>
            <CardTitle className="text-base font-mono">{invoice.serviceOrder?.reference || '—'}</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-1">
            {invoice.dueDate && <p>Échéance : {new Date(invoice.dueDate).toLocaleDateString('fr-FR')}</p>}
            {invoice.paidAt && <p>Payée le : {new Date(invoice.paidAt).toLocaleDateString('fr-FR')}</p>}
          </CardContent>
        </Card>

        <Card className="border-border shadow-sm hidden md:block">
          <CardHeader className="pb-2">
            <CardDescription>Solde</CardDescription>
            <CardTitle className={cn("text-2xl", isPaid ? 'text-green-600' : 'text-amber-600')}>
              {formatXAF(balance)}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            <div className="flex justify-between text-muted-foreground">
              <span>Total facturé</span>
              <span className="font-mono">{formatXAF(invoice.totalXaf)}</span>
            </div>
            <div className="flex justify-between text-muted-foreground">
              <span>Déjà payé</span>
              <span className="font-mono text-green-600">{formatXAF(invoice.amountPaidXaf)}</span>
            </div>
            {isPaid && (
              <div className="flex items-center gap-1 pt-1 text-green-600 font-bold">
                <CheckCircle2 size={14} /> Soldée
              </div>
            )}
            {!isPaid && (
              <div className="flex items-center gap-1 pt-1 text-amber-600 font-bold">
                <Clock size={14} /> En attente
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Lignes de facture */}
      <Card className="border-border shadow-sm overflow-hidden">
        <CardHeader className="bg-muted/30 border-b border-border">
          <CardTitle className="text-lg flex items-center gap-2">
            <Receipt size={20} className="text-brand" />
            Détails de la facture
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {lines.length === 0
            ? <p className="text-center py-12 text-muted-foreground text-sm">Aucune ligne</p>
            : <>
              {/* Desktop — tableau lignes */}
              <div className="hidden md:block">
                <div className="flex px-6 py-3 bg-muted/30 text-xs font-bold text-muted-foreground uppercase tracking-wider">
                  <span className="flex-1">Description</span>
                  <span className="w-16 text-right">Qté</span>
                  <span className="w-28 text-right">P.U.</span>
                  <span className="w-10 text-right">Rem.</span>
                  <span className="w-28 text-right">Total</span>
                </div>
                <div className="divide-y divide-border">
                  {lines.map((line: any, i: number) => (
                    <div key={i} className="flex items-center px-6 py-4">
                      <p className="flex-1 font-medium text-foreground">{line.description || '—'}</p>
                      <span className="w-16 text-right text-sm text-muted-foreground">{line.quantity}</span>
                      <span className="w-28 text-right text-sm font-mono">{formatXAF(line.unitPriceXaf)}</span>
                      <span className="w-10 text-right text-xs text-muted-foreground">
                        {Number(line.discountPct) > 0 ? `-${line.discountPct}%` : '—'}
                      </span>
                      <span className="w-28 text-right text-sm font-bold font-mono">{formatXAF(line.lineTotalXaf)}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Mobile — cartes lignes */}
              <div className="md:hidden divide-y divide-border">
                {lines.map((line: any, i: number) => (
                  <div key={i} className="p-4 space-y-2">
                    <p className="font-medium text-sm text-foreground leading-snug">{line.description || '—'}</p>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                      <div className="flex justify-between text-muted-foreground">
                        <span>Qté</span>
                        <span>{line.quantity}</span>
                      </div>
                      <div className="flex justify-between text-muted-foreground">
                        <span>P.U.</span>
                        <span className="font-mono">{formatXAF(line.unitPriceXaf)}</span>
                      </div>
                      {Number(line.discountPct) > 0 && (
                        <div className="flex justify-between text-muted-foreground col-span-2">
                          <span>Remise</span>
                          <span>-{line.discountPct}%</span>
                        </div>
                      )}
                      <div className="flex justify-between col-span-2 pt-1 border-t border-border/60 font-bold text-foreground">
                        <span>Total ligne</span>
                        <span className="font-mono">{formatXAF(line.lineTotalXaf)}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex justify-end px-4 sm:px-6 py-5 sm:py-6 border-t border-border">
                <div className="w-full sm:w-64 space-y-2">
                  <div className="flex justify-between text-sm text-muted-foreground">
                    <span>HT</span><span className="font-mono">{formatXAF(invoice.subtotalXaf)}</span>
                  </div>
                  <div className="flex justify-between text-sm text-muted-foreground">
                    <span>TVA ({Math.round(Number(invoice.taxRate) * 100)}%)</span>
                    <span className="font-mono">{formatXAF(invoice.taxAmountXaf)}</span>
                  </div>
                  {Number(invoice.stampDutyXaf) > 0 && (
                    <div className="flex justify-between text-sm text-muted-foreground">
                      <span>Timbre fiscal</span><span className="font-mono">{formatXAF(invoice.stampDutyXaf)}</span>
                    </div>
                  )}
                  <Separator />
                  <div className="flex justify-between text-lg font-bold text-foreground pt-1">
                    <span>Total TTC</span>
                    <span className="text-brand font-mono">{formatXAF(invoice.totalXaf)}</span>
                  </div>
                </div>
              </div>
            </>
          }
        </CardContent>
      </Card>

      {/* Historique des paiements */}
      {payments.length > 0 && (
        <Card className="border-border shadow-sm">
          <CardHeader>
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <CreditCard size={18} className="text-brand" />
              Paiements reçus ({payments.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {payments.map((p: any, i: number) => {
              const method = PAYMENT_METHODS.find(m => m.value === p.method);
              return (
                <div key={i} className="flex items-center justify-between gap-3 p-3 rounded-lg bg-muted/50">
                  <div className="flex items-center gap-3 min-w-0">
                    {method && <method.icon size={18} className="text-muted-foreground shrink-0" />}
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground">{method?.label ?? p.method}</p>
                      {p.transactionRef && (
                        <p className="text-xs font-mono text-muted-foreground truncate">{p.transactionRef}</p>
                      )}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-bold font-mono text-green-600">{formatXAF(p.amountXaf)}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(p.paidAt).toLocaleDateString('fr-FR')}
                    </p>
                  </div>
                </div>
              );
            })}
            <div className="flex justify-between pt-2 border-t border-border text-sm font-bold">
              <span className="text-muted-foreground">Total encaissé</span>
              <span className="font-mono text-green-600">{formatXAF(invoice.amountPaidXaf)}</span>
            </div>
          </CardContent>
        </Card>
      )}
    </div>

    {/* Barre d'encaissement fixe — mobile */}
    {canPay && (
      <div className="fixed bottom-0 inset-x-0 z-40 md:hidden border-t border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80 p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <div className="flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Reste à payer</p>
            <p className="text-lg font-bold font-mono text-amber-600 truncate">{formatXAF(balance)}</p>
          </div>
          <Button
            className="bg-brand hover:bg-brand-hover h-12 px-5 gap-2 font-bold rounded-xl shrink-0"
            onClick={() => setIsPaymentOpen(true)}
          >
            <CreditCard size={18} />
            Encaisser
          </Button>
        </div>
      </div>
    )}

    {paymentDialog}

    <div className="hidden print-only">
      {invoice && (
        <BillingDocument
          type="INVOICE"
          data={buildInvoicePrintData(invoice, workshop ?? FALLBACK_WORKSHOP_SETTINGS)}
        />
      )}
    </div>
    </>
  );
}
