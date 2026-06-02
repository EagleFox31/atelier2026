'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ArrowLeft, Plus, Trash2, Sparkles, Wrench, Package,
  User, Car, AlertCircle, Loader2, ChevronDown, ChevronUp,
} from "lucide-react";
import { workshopApi, billingApi } from "@/lib/api";
import { formatXAF, cn } from "@/lib/utils";
import { toast } from "sonner";
import { handleApiError } from "@/lib/api";
import { QuoteOtContextPanel } from "@/components/billing/QuoteOtContextPanel";
import { PartLineCombobox } from "@/components/forms/PartLineCombobox";
import { WORKSHOP_STATUS } from "@/lib/constants";
import { computeAmounts } from "@/src/shared/fiscal/compute-amounts";
import { FiscalHintLabel } from "@/components/fiscal/FiscalHintLabel";
import { TVA_RATE_LABEL } from "@/lib/fiscal-hints";

interface Line {
  id: string;
  description: string;
  lineType: 'LABOR' | 'PART' | 'OTHER';
  partId: string | null;
  quantity: number;
  unitPriceXaf: number;
  discountPct: number;
  auto: boolean; // suggestion automatique
}

function uid() { return Math.random().toString(36).slice(2); }

function computeTotals(lines: Line[]) {
  const subtotal = Math.round(
    lines.reduce((sum, l) => {
      const lineTotal = l.quantity * l.unitPriceXaf * (1 - l.discountPct / 100);
      return sum + lineTotal;
    }, 0),
  );
  const { taxAmount, stampDuty, total } = computeAmounts(subtotal);
  return { subtotal, tax: taxAmount, stampDuty, total };
}

function customerName(c: any) {
  if (!c) return '—';
  return c.customerType === 'COMPANY'
    ? c.companyName
    : [c.firstName, c.lastName].filter(Boolean).join(' ');
}

// Recherche simple par mots-clés dans la plainte client
function suggestFromComplaint(complaint: string, catalog: any[]): any[] {
  if (!complaint || catalog.length === 0) return [];
  const words = complaint.toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .split(/[\s,;.+/-]+/)
    .filter(w => w.length > 2);
  if (words.length === 0) return [];
  return catalog.filter(item => {
    const haystack = (item.descriptionFr + ' ' + (item.category ?? '') + ' ' + (item.keywords ?? ''))
      .toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    return words.some(w => haystack.includes(w));
  }).slice(0, 6);
}

/** Évite la redirection intempestive quand useSearchParams() n'est pas encore hydraté. */
function resolveServiceOrderId(searchParams: ReturnType<typeof useSearchParams>): string | null {
  const fromParams = searchParams.get('serviceOrderId');
  if (fromParams) return fromParams;
  if (typeof window !== 'undefined') {
    return new URLSearchParams(window.location.search).get('serviceOrderId');
  }
  return null;
}

function NewQuotePageContent() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const serviceOrderId = resolveServiceOrderId(searchParams);

  const [order,   setOrder]   = useState<any>(null);
  const [catalog, setCatalog] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [lines, setLines] = useState<Line[]>([]);
  const [quoteNotes, setQuoteNotes] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(true);
  const [validDays, setValidDays] = useState('30');
  const notesInitialized = useRef(false);

  // Charger OT + catalogue au montage
  useEffect(() => {
    const otId = resolveServiceOrderId(searchParams);
    if (!otId) {
      router.replace('/billing');
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    (async () => {
      try {
        const ot = await workshopApi.getOT(otId) as any;
        if (cancelled) return;
        setOrder(ot);
        try {
          const cat = await workshopApi.laborCatalog() as any[];
          if (!cancelled) setCatalog(cat);
        } catch {
          // Catalogue M.O. optionnel — la page reste utilisable
        }
      } catch (err) {
        if (cancelled) return;
        handleApiError(err, 'Impossible de charger l\'OT');
        router.replace(`/workshop/${otId}`);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [searchParams, router]);

  // Pré-remplissage description devis (modifiable par le chef)
  useEffect(() => {
    if (!order || notesInitialized.current) return;
    notesInitialized.current = true;
    const vehicle = [order.vehicle?.make?.name, order.vehicle?.model?.name].filter(Boolean).join(' ');
    const complaint = order.clientComplaint?.trim();
    setQuoteNotes(
      [
        `Forfait diagnostic et remise en état${vehicle ? ` — ${vehicle}` : ''}.`,
        complaint ? `Plainte client : ${complaint}` : null,
        'Tests électriques/mécaniques puis interventions selon constats technicien.',
        'Pièces listées posées uniquement si confirmées après diagnostic.',
      ].filter(Boolean).join('\n'),
    );
  }, [order]);

  // Suggestions basées sur la plainte
  const suggestions = useMemo(
    () => suggestFromComplaint(order?.clientComplaint ?? '', catalog),
    [order, catalog]
  );

  // Ajouter une suggestion comme ligne
  function addSuggestion(item: any) {
    if (lines.some(l => l.description === item.descriptionFr)) return;
    setLines(prev => [...prev, {
      id: uid(),
      description:   item.descriptionFr,
      lineType:      'LABOR',
      partId:        null,
      quantity:      1,
      unitPriceXaf:  item.unitPriceXaf ?? 0,
      discountPct:   0,
      auto:          true,
    }]);
  }

  function addBlankLine(type: 'LABOR' | 'PART' | 'OTHER' = 'LABOR') {
    setLines(prev => [...prev, {
      id: uid(), description: '', lineType: type, partId: null,
      quantity: 1, unitPriceXaf: 0, discountPct: 0, auto: false,
    }]);
  }

  function updatePartLine(id: string, next: { description: string; partId: string | null; unitPriceXaf: number }) {
    setLines(prev => prev.map(l => l.id === id ? { ...l, ...next } : l));
  }

  function updateLine(id: string, field: keyof Line, value: any) {
    setLines(prev => prev.map(l => l.id === id ? { ...l, [field]: value } : l));
  }

  function removeLine(id: string) {
    setLines(prev => prev.filter(l => l.id !== id));
  }

  async function handleSubmit() {
    if (!serviceOrderId) return;
    if (lines.length === 0) { toast.error('Ajoutez au moins une ligne'); return; }
    if (lines.some(l => !l.description.trim())) { toast.error('Toutes les lignes doivent avoir une description'); return; }
    setSubmitting(true);
    try {
      const { subtotal } = computeTotals(lines);
      const validUntil = new Date();
      validUntil.setDate(validUntil.getDate() + Number(validDays || 30));
      const quote = await billingApi.createQuote({
        serviceOrderId,
        customerId: order.customerId,
        subtotal,
        notes: quoteNotes.trim() || undefined,
        validUntil: validUntil.toISOString(),
        lines: lines.map(l => ({
          description:  l.description,
          lineType:     l.lineType === 'OTHER' ? 'LABOR' : l.lineType,
          partId:       l.lineType === 'PART' && l.partId ? l.partId : undefined,
          quantity:     l.quantity,
          unitPriceXaf: l.unitPriceXaf,
          discountPct:  l.discountPct || 0,
        })),
      }) as any;
      toast.success(`Devis ${quote.reference} créé`);
      router.push(`/billing/quotes/${quote.id}`);
    } catch (err) {
      handleApiError(err, 'Erreur lors de la création du devis');
    } finally {
      setSubmitting(false);
    }
  }

  const observations: any[] = order?.observations ?? [];
  const receptionChecks: any[] = order?.receptionChecks ?? [];
  const otStatus = order ? WORKSHOP_STATUS[order.status] : null;

  const { subtotal, tax, stampDuty, total } = computeTotals(lines);

  if (loading) return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Skeleton className="w-10 h-10 rounded-full" />
        <div className="space-y-2"><Skeleton className="h-7 w-48" /><Skeleton className="h-4 w-64" /></div>
      </div>
      <div className="grid grid-cols-3 gap-6">{[0,1,2].map(i => <Skeleton key={i} className="h-28" />)}</div>
      <Skeleton className="h-64 rounded-xl" />
    </div>
  );

  if (!order) return null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border/40 pb-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => router.push(`/workshop/${serviceOrderId}`)}>
            <ArrowLeft size={20} />
          </Button>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-bold text-foreground">Nouveau devis</h1>
              {otStatus && (
                <Badge className={cn('text-[10px] border-none font-bold', otStatus.color)}>
                  {otStatus.label}
                </Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground font-mono">{order.reference}</p>
          </div>
        </div>
        <Button onClick={handleSubmit} disabled={submitting || lines.length === 0} className="bg-brand hover:bg-brand-hover font-bold gap-2 hidden sm:inline-flex">
          {submitting && <Loader2 size={14} className="animate-spin" />}
          Créer le devis
        </Button>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_340px] gap-6 items-start">
        <div className="space-y-6 min-w-0">

      {/* Infos OT */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-border shadow-sm">
          <CardHeader className="pb-2 pt-4 px-4">
            <p className="text-xs text-muted-foreground flex items-center gap-1"><User size={12} /> Client</p>
            <p className="font-bold text-foreground">{customerName(order.customer)}</p>
          </CardHeader>
          <CardContent className="px-4 pb-4 text-sm text-muted-foreground">
            {order.customer?.phonePrimary}
          </CardContent>
        </Card>
        <Card className="border-border shadow-sm">
          <CardHeader className="pb-2 pt-4 px-4">
            <p className="text-xs text-muted-foreground flex items-center gap-1"><Car size={12} /> Véhicule</p>
            <p className="font-bold text-foreground">
              {[order.vehicle?.make?.name, order.vehicle?.model?.name].filter(Boolean).join(' ') || '—'}
            </p>
          </CardHeader>
          <CardContent className="px-4 pb-4 text-sm text-muted-foreground">
            {order.vehicle?.plateNumber} · {order.mileageIn?.toLocaleString()} km
          </CardContent>
        </Card>
        <Card className="border-border shadow-sm">
          <CardHeader className="pb-2 pt-4 px-4">
            <p className="text-xs text-muted-foreground flex items-center gap-1"><AlertCircle size={12} /> Plainte client</p>
          </CardHeader>
          <CardContent className="px-4 pb-4 text-sm text-foreground leading-relaxed">
            {order.clientComplaint}
          </CardContent>
        </Card>
      </div>

      {/* Description globale du devis */}
      <Card className="border-border shadow-sm">
        <CardHeader className="pb-2 pt-4 px-4">
          <CardTitle className="text-sm font-bold text-foreground">
            Description du devis
          </CardTitle>
          <p className="text-xs text-muted-foreground font-normal mt-1">
            Objet et conditions — visible sur le devis client (impression / envoi)
          </p>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          <Textarea
            value={quoteNotes}
            onChange={e => setQuoteNotes(e.target.value)}
            rows={5}
            placeholder="Ex. Forfait diagnostic démarrage, tests puis remplacement batterie et/ou démarreur selon résultats…"
            className="text-sm bg-muted/30 border-border resize-y min-h-[120px]"
          />
        </CardContent>
      </Card>

      {/* Suggestions automatiques */}
      {suggestions.length > 0 && (
        <Card className="border-brand/20 bg-brand/5 shadow-sm">
          <CardHeader className="pb-2 pt-4 px-4">
            <button
              type="button"
              className="flex items-center justify-between w-full"
              onClick={() => setShowSuggestions(v => !v)}
            >
              <CardTitle className="text-sm font-bold flex items-center gap-2 text-brand">
                <Sparkles size={16} />
                Suggestions basées sur la plainte ({suggestions.length})
              </CardTitle>
              {showSuggestions ? <ChevronUp size={16} className="text-muted-foreground" /> : <ChevronDown size={16} className="text-muted-foreground" />}
            </button>
          </CardHeader>
          {showSuggestions && (
            <CardContent className="px-4 pb-4">
              <div className="flex flex-wrap gap-2">
                {suggestions.map((item: any) => {
                  const already = lines.some(l => l.description === item.descriptionFr);
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => addSuggestion(item)}
                      disabled={already}
                      className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium transition-all ${
                        already
                          ? 'border-border bg-muted text-muted-foreground cursor-not-allowed opacity-50'
                          : 'border-brand/30 bg-white hover:bg-brand/10 text-foreground cursor-pointer'
                      }`}
                    >
                      <Plus size={13} className={already ? 'text-muted-foreground' : 'text-brand'} />
                      <span>{item.descriptionFr}</span>
                      {item.unitPriceXaf > 0 && (
                        <span className="text-xs text-muted-foreground font-mono ml-1">
                          {formatXAF(item.unitPriceXaf)}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
              <p className="text-xs text-muted-foreground mt-3">
                Cliquez pour ajouter une ligne. Les prix sont éditables.
              </p>
            </CardContent>
          )}
        </Card>
      )}

      {/* Lignes du devis */}
      <Card className="border-border shadow-sm overflow-hidden">
        <CardHeader className="bg-muted/30 border-b border-border px-6 py-4">
          <CardTitle className="text-base font-bold flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Wrench size={18} className="text-brand" />
              Lignes du devis
              <span className="text-sm font-normal text-muted-foreground">({lines.length})</span>
            </span>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" className="gap-1 border-border text-xs h-8" onClick={() => addBlankLine('LABOR')}>
                <Plus size={13} /><Wrench size={13} /> Main d&apos;œuvre
              </Button>
              <Button size="sm" variant="outline" className="gap-1 border-border text-xs h-8" onClick={() => addBlankLine('PART')}>
                <Plus size={13} /><Package size={13} /> Pièce
              </Button>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {lines.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-14 gap-3 text-muted-foreground">
              <Wrench size={32} strokeWidth={1} />
              <p className="text-sm">Aucune ligne — utilisez les suggestions ou ajoutez manuellement</p>
            </div>
          ) : (
            <>
              {/* Entêtes colonnes */}
              <div className="grid grid-cols-[1fr_90px_100px_80px_70px_36px] gap-2 px-4 py-2 bg-muted/30 text-xs font-bold text-muted-foreground uppercase tracking-wider">
                <span>Description</span>
                <span className="text-right">Type</span>
                <span className="text-right">P.U. (XAF)</span>
                <span className="text-right">Qté</span>
                <span className="text-right">Total</span>
                <span />
              </div>
              <ScrollArea className={lines.length > 6 ? 'h-[340px]' : undefined}>
                <div className="divide-y divide-border">
                  {lines.map(line => {
                    const lineTotal = Math.round(line.quantity * line.unitPriceXaf * (1 - line.discountPct / 100));
                    return (
                      <div key={line.id} className="grid grid-cols-[1fr_90px_100px_80px_70px_36px] gap-2 items-center px-4 py-3">
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          {line.auto && (
                            <Badge className="shrink-0 text-[9px] px-1.5 py-0 bg-brand/10 text-brand border-brand/20 border">Auto</Badge>
                          )}
                          {line.lineType === 'PART' ? (
                            <PartLineCombobox
                              value={{
                                description: line.description,
                                partId: line.partId,
                                unitPriceXaf: line.unitPriceXaf,
                              }}
                              onChange={(next) => updatePartLine(line.id, next)}
                            />
                          ) : (
                            <Input
                              value={line.description}
                              onChange={e => updateLine(line.id, 'description', e.target.value)}
                              placeholder="Description de la prestation…"
                              className="h-8 text-sm bg-transparent border-transparent hover:border-border focus:border-brand focus:bg-muted transition-colors"
                            />
                          )}
                        </div>
                        <div className="flex justify-end">
                          <Badge variant="outline" className="text-[9px] border-border whitespace-nowrap">
                            {line.lineType === 'LABOR' ? 'M.O.' : line.lineType === 'PART' ? 'Pièce' : 'Autre'}
                          </Badge>
                        </div>
                        <Input
                          type="number"
                          min={0}
                          value={line.unitPriceXaf || ''}
                          onChange={e => updateLine(line.id, 'unitPriceXaf', Number(e.target.value))}
                          className="h-8 text-sm text-right font-mono bg-muted border-border"
                          placeholder="0"
                        />
                        <Input
                          type="number"
                          min={1}
                          value={line.quantity}
                          onChange={e => updateLine(line.id, 'quantity', Math.max(1, Number(e.target.value)))}
                          className="h-8 text-sm text-right bg-muted border-border"
                        />
                        <span className="text-right text-sm font-bold font-mono text-foreground pr-1">
                          {formatXAF(lineTotal)}
                        </span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-muted-foreground hover:text-red-600 hover:bg-red-50"
                          onClick={() => removeLine(line.id)}
                        >
                          <Trash2 size={14} />
                        </Button>
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
            </>
          )}

          {/* Totaux */}
          {lines.length > 0 && (
            <div className="flex justify-end px-6 py-5 border-t border-border bg-muted/20">
              <div className="w-64 space-y-2">
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>Sous-total HT</span>
                  <span className="font-mono">{formatXAF(subtotal)}</span>
                </div>
                <div className="flex justify-between text-sm text-muted-foreground">
                  <FiscalHintLabel hint="tva">
                    <span>TVA {TVA_RATE_LABEL}</span>
                  </FiscalHintLabel>
                  <span className="font-mono">{formatXAF(tax)}</span>
                </div>
                {stampDuty > 0 && (
                  <div className="flex justify-between text-sm text-muted-foreground">
                    <FiscalHintLabel hint="stamp">
                      <span>Timbre fiscal</span>
                    </FiscalHintLabel>
                    <span className="font-mono">{formatXAF(stampDuty)}</span>
                  </div>
                )}
                <Separator />
                <div className="flex justify-between text-lg font-bold text-foreground">
                  <span>Total TTC</span>
                  <span className="text-brand font-mono">{formatXAF(total)}</span>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Validité + soumettre */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Label className="text-sm font-semibold text-muted-foreground whitespace-nowrap">
            Validité (jours)
          </Label>
          <Input
            type="number"
            min={1}
            max={90}
            value={validDays}
            onChange={e => setValidDays(e.target.value)}
            className="w-20 h-8 bg-muted border-border text-center"
          />
        </div>
        <Button onClick={handleSubmit} disabled={submitting || lines.length === 0} size="lg" className="bg-brand hover:bg-brand-hover font-bold gap-2">
          {submitting && <Loader2 size={16} className="animate-spin" />}
          Créer le devis · {formatXAF(total)}
        </Button>
      </div>
        </div>

        <QuoteOtContextPanel
          observations={observations}
          receptionChecks={receptionChecks}
        />
      </div>
    </div>
  );
}

function NewQuotePageSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Skeleton className="w-10 h-10 rounded-full" />
        <div className="space-y-2"><Skeleton className="h-7 w-48" /><Skeleton className="h-4 w-64" /></div>
      </div>
      <div className="grid grid-cols-3 gap-6">{[0, 1, 2].map(i => <Skeleton key={i} className="h-28" />)}</div>
      <Skeleton className="h-64 rounded-xl" />
    </div>
  );
}

export default function NewQuotePage() {
  return (
    <React.Suspense fallback={<NewQuotePageSkeleton />}>
      <NewQuotePageContent />
    </React.Suspense>
  );
}
