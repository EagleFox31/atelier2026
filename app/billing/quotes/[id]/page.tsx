'use client';

import React, { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, Printer, FileText, CheckCircle2, XCircle, RefreshCw, Car, User, AlertCircle, UserCircle, Send } from "lucide-react";
import { billingApi } from "@/lib/api";
import { useApi } from "@/hooks/use-api";
import { formatXAF, cn } from "@/lib/utils";
import { quoteApprovalMethodLabel, QUOTE_APPROVAL_METHOD_LABELS } from "@/lib/constants";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { handleApiError } from "@/lib/api";
import { useAuth } from "@/contexts/auth-context";
import { FiscalHintLabel } from "@/components/fiscal/FiscalHintLabel";

const QUOTE_STATUS: Record<string, { label: string; color: string }> = {
  DRAFT:    { label: 'Brouillon',  color: 'bg-slate-100 text-slate-600' },
  SENT:     { label: 'Envoyé',     color: 'bg-brand-light text-brand-hover' },
  APPROVED: { label: 'Approuvé',   color: 'bg-green-50 text-green-700' },
  REJECTED: { label: 'Refusé',     color: 'bg-red-50 text-red-600' },
  REVISED:  { label: 'Révisé',     color: 'bg-amber-50 text-amber-700' },
  BILLED:   { label: 'Facturé',    color: 'bg-slate-100 text-slate-500' },
};

const LINE_TYPE: Record<string, string> = {
  LABOR: 'Main d\'œuvre',
  PART:  'Pièce',
  OTHER: 'Autre',
};

function customerName(c: any) {
  if (!c) return '—';
  return c.customerType === 'COMPANY'
    ? c.companyName
    : [c.firstName, c.lastName].filter(Boolean).join(' ');
}

function personName(p: { firstName?: string; lastName?: string } | null | undefined) {
  if (!p) return null;
  const name = [p.firstName, p.lastName].filter(Boolean).join(' ');
  return name || null;
}

export default function QuoteDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const { hasRole, hasPermission } = useAuth();
  const canInvoice = hasRole('ADMIN') || hasRole('CHEF_ATELIER') || hasRole('SUPER_ADMIN');
  const canModifyBilling = hasPermission('FAC_CREATE');
  const [actionLoading, setActionLoading] = useState(false);
  const [isApproveOpen, setIsApproveOpen] = useState(false);
  const [approvalMethod, setApprovalMethod] = useState<keyof typeof QUOTE_APPROVAL_METHOD_LABELS>('VERBAL_NOTED');

  const { data: quote, loading, refetch } = useApi(
    () => billingApi.getQuote(id) as Promise<any>,
    [id]
  );

  function handlePrintPdf() {
    window.open(`/billing/quotes/${id}/print`, '_blank', 'noopener,noreferrer');
  }

  async function handleSend() {
    setActionLoading(true);
    try {
      await billingApi.sendQuote(id);
      toast.success('Devis soumis au client — OT passé en attente de validation');
      refetch();
    } catch (err: unknown) {
      handleApiError(err, 'Erreur lors de la soumission');
    } finally {
      setActionLoading(false);
    }
  }

  async function handleApprove(method: keyof typeof QUOTE_APPROVAL_METHOD_LABELS) {
    setActionLoading(true);
    try {
      await billingApi.approveQuote(id, { clientApprovalMethod: method });
      toast.success('Devis approuvé — validation client enregistrée');
      setIsApproveOpen(false);
      refetch();
    } catch (err: unknown) {
      handleApiError(err, 'Erreur lors de l\'approbation');
    } finally {
      setActionLoading(false);
    }
  }

  async function handleConvertToInvoice() {
    setActionLoading(true);
    try {
      const invoice = await billingApi.createInvoiceFromQuote(id) as any;
      toast.success(`Facture ${invoice.reference} créée`);
      router.push(`/billing/invoices/${invoice.id}`);
    } catch (err: unknown) {
      handleApiError(err, 'Erreur lors de la conversion');
    } finally {
      setActionLoading(false);
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
      <Skeleton className="h-64 rounded-xl" />
    </div>
  );

  if (!quote) return (
    <div className="flex flex-col items-center justify-center py-20 gap-4">
      <AlertCircle size={48} className="text-red-500" />
      <h2 className="text-xl font-bold text-foreground">Devis introuvable</h2>
      <Button variant="link" onClick={() => router.push('/billing')}>Retour à la facturation</Button>
    </div>
  );

  const st = QUOTE_STATUS[quote.status] ?? { label: quote.status, color: '' };
  const lines: any[] = quote.lines || [];
  const creatorName = personName(quote.creator);
  const canSend     = quote.status === 'DRAFT' && canModifyBilling;
  const canApprove  = quote.status === 'SENT' && canModifyBilling;
  const canConvert  = quote.status === 'APPROVED' && canInvoice;
  const alreadyBilled = quote.status === 'BILLED';
  const hasMobileAction = canSend || canApprove || canConvert;

  return (
    <div className={cn('space-y-6', hasMobileAction && 'pb-28 md:pb-0')}>
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3 min-w-0">
          <Button variant="ghost" size="icon" onClick={() => router.back()} className="shrink-0 mt-0.5">
            <ArrowLeft size={20} />
          </Button>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-bold text-foreground font-mono truncate">{quote.reference}</h1>
              <Badge className={cn('font-bold border-none shrink-0', st.color)}>{st.label}</Badge>
            </div>
            <div className="text-muted-foreground text-xs sm:text-sm mt-1 space-y-0.5">
              <p>Créé le {new Date(quote.createdAt).toLocaleDateString('fr-FR')}</p>
              {creatorName && <p>Établi par <span className="font-medium text-foreground">{creatorName}</span></p>}
              {quote.serviceOrder && (
                <p>OT <span className="font-mono">{quote.serviceOrder.reference}</span></p>
              )}
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 pl-12 sm:pl-0 shrink-0">
          <Button variant="outline" size="sm" className="gap-2 border-border rounded-xl" onClick={handlePrintPdf}>
            <Printer size={16} />
            <span className="hidden sm:inline">Imprimer / PDF</span>
          </Button>
          {canSend && (
            <Button
              className="bg-brand hover:bg-brand-hover gap-2 rounded-xl hidden md:inline-flex"
              onClick={handleSend}
              disabled={actionLoading}
            >
              <Send size={16} />
              Soumettre au client
            </Button>
          )}
          {canApprove && (
            <Button
              className="bg-green-600 hover:bg-green-700 gap-2 rounded-xl hidden md:inline-flex"
              onClick={() => setIsApproveOpen(true)}
              disabled={actionLoading}
            >
              <CheckCircle2 size={16} />
              Approuvé par le client
            </Button>
          )}
          {canConvert && (
            <Button
              className="bg-brand hover:bg-brand-hover gap-2 rounded-xl hidden md:inline-flex"
              onClick={handleConvertToInvoice}
              disabled={actionLoading}
            >
              <RefreshCw size={16} className={actionLoading ? 'animate-spin' : ''} />
              Convertir en Facture
            </Button>
          )}
          {alreadyBilled && (
            <Badge className="bg-slate-100 text-slate-500 border-none px-4 py-2 hidden md:inline-flex">
              Déjà facturé
            </Badge>
          )}
        </div>
      </div>

      {/* Total TTC — bandeau mobile */}
      <Card className="border-brand/20 bg-brand/5 shadow-sm md:hidden">
        <CardContent className="p-4 flex items-center justify-between gap-4">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Total TTC</p>
            <p className="text-2xl font-bold font-mono text-brand mt-0.5">{formatXAF(quote.totalXaf)}</p>
            <p className="text-xs text-muted-foreground mt-1">
              HT {formatXAF(quote.subtotalXaf)} · TVA {formatXAF(quote.taxAmountXaf)}
            </p>
          </div>
          <FileText size={32} className="text-brand/40 shrink-0" />
        </CardContent>
      </Card>

      {/* Infos */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
        <Card className="border-border shadow-sm">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1"><User size={14} /> Client</CardDescription>
            <CardTitle className="text-base sm:text-lg leading-tight">{customerName(quote.customer)}</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-1">
            {quote.customer?.phonePrimary && (
              <a href={`tel:${quote.customer.phonePrimary.replace(/\s/g, '')}`} className="hover:text-foreground">
                {quote.customer.phonePrimary}
              </a>
            )}
            {quote.customer?.city && <p>{quote.customer.city}</p>}
          </CardContent>
        </Card>

        <Card className="border-border shadow-sm">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1"><Car size={14} /> OT associé</CardDescription>
            <CardTitle className="text-base font-mono">{quote.serviceOrder?.reference || '—'}</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-1">
            {quote.validUntil && (
              <p>Valable jusqu&apos;au {new Date(quote.validUntil).toLocaleDateString('fr-FR')}</p>
            )}
            {creatorName && (
              <p className="flex items-center gap-1.5">
                <UserCircle size={13} className="shrink-0" />
                Devis établi par <span className="font-medium text-foreground">{creatorName}</span>
              </p>
            )}
          </CardContent>
        </Card>

        <Card className="border-border shadow-sm hidden md:block">
          <CardHeader className="pb-2">
            <CardDescription>Total TTC</CardDescription>
            <CardTitle className="text-2xl text-brand">{formatXAF(quote.totalXaf)}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm text-muted-foreground">
            <div className="flex justify-between">
              <span>HT</span>
              <span>{formatXAF(quote.subtotalXaf)}</span>
            </div>
            <div className="flex justify-between">
              <FiscalHintLabel hint="tva">
                <span>TVA ({Math.round(Number(quote.taxRate) * 100)}%)</span>
              </FiscalHintLabel>
              <span>{formatXAF(quote.taxAmountXaf)}</span>
            </div>
            {Number(quote.stampDutyXaf) > 0 && (
              <div className="flex justify-between">
                <FiscalHintLabel hint="stamp">
                  <span>Timbre fiscal</span>
                </FiscalHintLabel>
                <span>{formatXAF(quote.stampDutyXaf)}</span>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {quote.notes && (
        <Card className="border-border shadow-sm">
          <CardHeader className="pb-2">
            <CardDescription>Description du devis</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">{quote.notes}</p>
          </CardContent>
        </Card>
      )}

      {/* Lignes du devis */}
      <Card className="border-border shadow-sm overflow-hidden">
        <CardHeader className="bg-muted/30 border-b border-border">
          <CardTitle className="text-lg flex items-center gap-2">
            <FileText size={20} className="text-brand" />
            Proposition commerciale
            <span className="text-sm font-normal text-muted-foreground ml-1">({lines.length} ligne{lines.length > 1 ? 's' : ''})</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {lines.length === 0
            ? <p className="text-center py-12 text-muted-foreground text-sm">Aucune ligne dans ce devis</p>
            : <>
              {/* Desktop — tableau lignes */}
              <div className="hidden md:block">
                <div className="flex px-6 py-3 bg-muted/30 text-xs font-bold text-muted-foreground uppercase tracking-wider">
                  <span className="flex-1">Description</span>
                  <span className="w-20 text-right">Type</span>
                  <span className="w-16 text-right">Qté</span>
                  <span className="w-28 text-right">P.U.</span>
                  <span className="w-10 text-right">Rem.</span>
                  <span className="w-28 text-right">Total</span>
                </div>
                <div className="divide-y divide-border">
                  {lines.map((line: any, i: number) => (
                    <div key={i} className="flex items-center px-6 py-4">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-foreground">{line.description || '—'}</p>
                        {line.laborCatalog && (
                          <p className="text-xs text-muted-foreground mt-0.5">{line.laborCatalog.descriptionFr}</p>
                        )}
                      </div>
                      <span className="w-20 text-right">
                        <Badge variant="outline" className="text-[9px] border-border">
                          {LINE_TYPE[line.lineType] ?? line.lineType}
                        </Badge>
                      </span>
                      <span className="w-16 text-right text-sm text-muted-foreground">{line.quantity}</span>
                      <span className="w-28 text-right text-sm font-mono">{formatXAF(line.unitPriceXaf)}</span>
                      <span className="w-10 text-right text-xs text-muted-foreground">
                        {Number(line.discountPct) > 0 ? `-${line.discountPct}%` : '—'}
                      </span>
                      <span className="w-28 text-right text-sm font-bold font-mono text-foreground">
                        {formatXAF(line.lineTotalXaf)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Mobile — cartes lignes */}
              <div className="md:hidden divide-y divide-border">
                {lines.map((line: any, i: number) => (
                  <div key={i} className="p-4 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-medium text-sm text-foreground leading-snug flex-1">{line.description || '—'}</p>
                      <Badge variant="outline" className="text-[9px] border-border shrink-0">
                        {LINE_TYPE[line.lineType] ?? line.lineType}
                      </Badge>
                    </div>
                    {line.laborCatalog && (
                      <p className="text-xs text-muted-foreground">{line.laborCatalog.descriptionFr}</p>
                    )}
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

              {/* Totaux */}
              <div className="flex justify-end px-4 sm:px-6 py-5 sm:py-6 border-t border-border">
                <div className="w-full sm:w-64 space-y-2">
                  <div className="flex justify-between text-sm text-muted-foreground">
                    <span>Sous-total HT</span>
                    <span className="font-mono">{formatXAF(quote.subtotalXaf)}</span>
                  </div>
                  <div className="flex justify-between text-sm text-muted-foreground">
                    <FiscalHintLabel hint="tva">
                      <span>TVA ({Math.round(Number(quote.taxRate) * 100)}%)</span>
                    </FiscalHintLabel>
                    <span className="font-mono">{formatXAF(quote.taxAmountXaf)}</span>
                  </div>
                  {Number(quote.stampDutyXaf) > 0 && (
                    <div className="flex justify-between text-sm text-muted-foreground">
                      <FiscalHintLabel hint="stamp">
                        <span>Timbre fiscal</span>
                      </FiscalHintLabel>
                      <span className="font-mono">{formatXAF(quote.stampDutyXaf)}</span>
                    </div>
                  )}
                  <Separator />
                  <div className="flex justify-between text-lg font-bold text-foreground pt-1">
                    <span>Total TTC</span>
                    <span className="text-brand font-mono">{formatXAF(quote.totalXaf)}</span>
                  </div>
                </div>
              </div>
            </>
          }
        </CardContent>
      </Card>

      {/* Signature */}
      {quote.approvedByClientAt && (
        <Card className="border-green-500/20 bg-green-500/5 shadow-sm">
          <CardContent className="p-4 flex items-center gap-3">
            <CheckCircle2 className="text-green-600 shrink-0" size={20} />
            <div>
              <p className="text-sm font-bold text-foreground">Approuvé par le client</p>
              <p className="text-xs text-muted-foreground">
                {new Date(quote.approvedByClientAt).toLocaleString('fr-FR')}
                {quote.clientApprovalMethod && (
                  <> · {quoteApprovalMethodLabel(quote.clientApprovalMethod)}</>
                )}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Barre d'action fixe — mobile */}
      {hasMobileAction && (
        <div className="fixed bottom-0 inset-x-0 z-40 md:hidden border-t border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80 p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <div className="flex items-center gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Total TTC</p>
              <p className="text-lg font-bold font-mono text-brand truncate">{formatXAF(quote.totalXaf)}</p>
            </div>
            {canSend && (
              <Button
                className="bg-brand hover:bg-brand-hover h-12 px-4 gap-2 font-bold rounded-xl shrink-0"
                onClick={handleSend}
                disabled={actionLoading}
              >
                <Send size={18} />
                Soumettre
              </Button>
            )}
            {canApprove && (
              <Button
                className="bg-green-600 hover:bg-green-700 h-12 px-4 gap-2 font-bold rounded-xl shrink-0"
                onClick={() => setIsApproveOpen(true)}
                disabled={actionLoading}
              >
                <CheckCircle2 size={18} />
                Approuver
              </Button>
            )}
            {canConvert && (
              <Button
                className="bg-brand hover:bg-brand-hover h-12 px-4 gap-2 font-bold rounded-xl shrink-0"
                onClick={handleConvertToInvoice}
                disabled={actionLoading}
              >
                <RefreshCw size={18} className={actionLoading ? 'animate-spin' : ''} />
                Facturer
              </Button>
            )}
          </div>
        </div>
      )}

      {alreadyBilled && (
        <div className="md:hidden">
          <Badge className="w-full justify-center bg-slate-100 text-slate-500 border-none px-4 py-3">
            Déjà facturé
          </Badge>
        </div>
      )}

      <Dialog open={isApproveOpen} onOpenChange={setIsApproveOpen}>
        <DialogContent className="w-[calc(100%-2rem)] max-w-md bg-card border-border">
          <DialogHeader>
            <DialogTitle>Comment le client a-t-il validé ?</DialogTitle>
            <p className="text-sm text-muted-foreground">
              Choisissez le mode d&apos;accord — ce libellé apparaîtra sur le devis.
            </p>
          </DialogHeader>
          <div className="space-y-2 pt-2">
            {(Object.entries(QUOTE_APPROVAL_METHOD_LABELS) as [keyof typeof QUOTE_APPROVAL_METHOD_LABELS, string][]).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setApprovalMethod(value)}
                className={cn(
                  'w-full text-left rounded-xl border px-4 py-3 text-sm transition-colors',
                  approvalMethod === value
                    ? 'border-green-600 bg-green-50 text-green-900 font-semibold'
                    : 'border-border hover:bg-muted/50',
                )}
              >
                {label}
              </button>
            ))}
          </div>
          <Button
            className="w-full bg-green-600 hover:bg-green-700 mt-2"
            disabled={actionLoading}
            onClick={() => handleApprove(approvalMethod)}
          >
            {actionLoading ? 'Enregistrement…' : 'Confirmer l\'approbation'}
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
