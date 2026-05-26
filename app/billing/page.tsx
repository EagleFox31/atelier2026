'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Plus, Search, FileText, Download, CreditCard, MoreVertical, ArrowUpRight, TrendingUp, Clock, AlertTriangle } from "lucide-react";
import { useRouter } from "next/navigation";
import { billingApi, handleApiError } from "@/lib/api";
import { formatXAF, cn } from "@/lib/utils";
import { toast } from "sonner";

// ─── Statuts ─────────────────────────────────────────────────────────────────
const QUOTE_STATUS: Record<string, { label: string; color: string }> = {
  DRAFT:    { label: 'Brouillon',  color: 'bg-slate-100 text-slate-600' },
  SENT:     { label: 'Envoyé',     color: 'bg-blue-50 text-blue-700' },
  APPROVED: { label: 'Approuvé',   color: 'bg-green-50 text-green-700' },
  REJECTED: { label: 'Refusé',     color: 'bg-red-50 text-red-600' },
  REVISED:  { label: 'Révisé',     color: 'bg-amber-50 text-amber-700' },
  BILLED:   { label: 'Facturé',    color: 'bg-slate-100 text-slate-500' },
};

const INVOICE_STATUS: Record<string, { label: string; color: string }> = {
  DRAFT:     { label: 'Brouillon',       color: 'bg-slate-100 text-slate-600' },
  ISSUED:    { label: 'Émise',           color: 'bg-blue-50 text-blue-700' },
  PARTIAL:   { label: 'Partiel',         color: 'bg-amber-50 text-amber-700' },
  PAID:      { label: 'Payée',           color: 'bg-green-50 text-green-700' },
  DISPUTED:  { label: 'Contestée',       color: 'bg-orange-50 text-orange-700' },
  CANCELLED: { label: 'Annulée',         color: 'bg-red-50 text-red-600' },
};

function customerName(c: any) {
  if (!c) return '—';
  return c.customerType === 'COMPANY'
    ? c.companyName
    : [c.firstName, c.lastName].filter(Boolean).join(' ');
}

export default function BillingPage() {
  const router = useRouter();
  const [invoices, setInvoices] = useState<any[]>([]);
  const [quotes, setQuotes]   = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch]   = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [inv, q] = await Promise.all([
        billingApi.listInvoices() as Promise<any[]>,
        billingApi.listQuotes()   as Promise<any[]>,
      ]);
      setInvoices(inv);
      setQuotes(q);
    } catch (err: unknown) {
      handleApiError(err, 'Impossible de charger la facturation');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // ── KPIs ────────────────────────────────────────────────────────────────────
  const totalPaid    = invoices.filter(i => i.status === 'PAID').reduce((s, i) => s + Number(i.totalXaf), 0);
  const totalPending = invoices.filter(i => ['ISSUED','PARTIAL'].includes(i.status)).reduce((s, i) => s + Number(i.balanceXaf), 0);
  const totalLate    = invoices.filter(i => i.status === 'ISSUED' && i.dueDate && new Date(i.dueDate) < new Date()).reduce((s, i) => s + Number(i.balanceXaf), 0);

  const filteredInvoices = invoices.filter(i => {
    const name = customerName(i.customer).toLowerCase();
    const ref  = (i.reference || '').toLowerCase();
    const q    = search.toLowerCase();
    return name.includes(q) || ref.includes(q);
  });

  const filteredQuotes = quotes.filter(q => {
    const name = customerName(q.customer).toLowerCase();
    const ref  = (q.reference || '').toLowerCase();
    const s    = search.toLowerCase();
    return name.includes(s) || ref.includes(s);
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Facturation & Devis</h1>
          <p className="text-muted-foreground">Gérez vos documents financiers et paiements</p>
        </div>
        <Button className="bg-brand hover:bg-brand-hover gap-2" onClick={() => router.push('/workshop')}>
          <Plus size={18} />
          Devis depuis OT
        </Button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {loading
          ? Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)
          : <>
            <Card className="border-border shadow-sm">
              <CardContent className="p-6 flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-green-500/10 flex items-center justify-center shrink-0">
                  <TrendingUp className="text-green-600" size={22} />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Encaissé (total)</p>
                  <p className="text-2xl font-bold text-foreground">{formatXAF(totalPaid)}</p>
                  <Badge className="mt-1 bg-green-50 text-green-700 border-none text-[10px]">
                    {invoices.filter(i => i.status === 'PAID').length} factures soldées
                  </Badge>
                </div>
              </CardContent>
            </Card>
            <Card className="border-border shadow-sm">
              <CardContent className="p-6 flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-amber-500/10 flex items-center justify-center shrink-0">
                  <Clock className="text-amber-600" size={22} />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">En attente</p>
                  <p className="text-2xl font-bold text-amber-600">{formatXAF(totalPending)}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {invoices.filter(i => ['ISSUED','PARTIAL'].includes(i.status)).length} factures
                  </p>
                </div>
              </CardContent>
            </Card>
            <Card className="border-border shadow-sm">
              <CardContent className="p-6 flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-red-500/10 flex items-center justify-center shrink-0">
                  <AlertTriangle className="text-red-500" size={22} />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Impayés / Retards</p>
                  <p className="text-2xl font-bold text-red-600">{formatXAF(totalLate)}</p>
                  <p className="text-xs text-muted-foreground mt-1">Échéance dépassée</p>
                </div>
              </CardContent>
            </Card>
          </>
        }
      </div>

      {/* Tabs Factures / Devis */}
      <Tabs defaultValue="invoices" className="w-full">
        <div className="flex items-center justify-between mb-4">
          <TabsList className="bg-muted p-1">
            <TabsTrigger value="invoices">
              Factures ({invoices.length})
            </TabsTrigger>
            <TabsTrigger value="quotes">
              Devis ({quotes.length})
            </TabsTrigger>
          </TabsList>
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
            <Input
              placeholder="Rechercher..."
              className="pl-9 h-9 bg-muted border-border text-sm"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
        </div>

        {/* Factures */}
        <TabsContent value="invoices">
          <Card className="border-border shadow-sm">
            <CardContent className="p-0">
              <Table>
                <TableHeader className="bg-muted/50">
                  <TableRow>
                    <TableHead className="font-bold">Référence</TableHead>
                    <TableHead className="font-bold">Client</TableHead>
                    <TableHead className="font-bold">Date</TableHead>
                    <TableHead className="font-bold">Total</TableHead>
                    <TableHead className="font-bold">Reste à payer</TableHead>
                    <TableHead className="font-bold">Statut</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading
                    ? Array.from({ length: 4 }).map((_, i) => (
                      <TableRow key={i}>
                        {Array.from({ length: 7 }).map((_, j) => (
                          <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>
                        ))}
                      </TableRow>
                    ))
                    : filteredInvoices.map(inv => {
                      const st = INVOICE_STATUS[inv.status] ?? { label: inv.status, color: '' };
                      const isLate = inv.status === 'ISSUED' && inv.dueDate && new Date(inv.dueDate) < new Date();
                      return (
                        <TableRow
                          key={inv.id}
                          className="hover:bg-muted/50 cursor-pointer"
                          onClick={() => router.push(`/billing/invoices/${inv.id}`)}
                        >
                          <TableCell className="font-mono text-xs font-bold text-foreground">
                            {inv.reference}
                          </TableCell>
                          <TableCell>
                            <p className="font-medium text-foreground">{customerName(inv.customer)}</p>
                            <p className="text-xs text-muted-foreground">{inv.serviceOrder?.reference}</p>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {inv.issuedAt ? new Date(inv.issuedAt).toLocaleDateString('fr-FR') : '—'}
                          </TableCell>
                          <TableCell className="font-mono text-sm font-bold">{formatXAF(inv.totalXaf)}</TableCell>
                          <TableCell className={cn("font-mono text-sm font-bold", Number(inv.balanceXaf) > 0 ? 'text-amber-600' : 'text-green-600')}>
                            {formatXAF(inv.balanceXaf)}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Badge className={cn("text-[10px] border-none", st.color)}>{st.label}</Badge>
                              {isLate && <Badge className="text-[10px] border-none bg-red-50 text-red-600">Retard</Badge>}
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              {inv.status !== 'PAID' && inv.status !== 'CANCELLED' && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-7 px-2 text-[10px] border-brand text-brand hover:bg-brand hover:text-white"
                                  onClick={e => { e.stopPropagation(); router.push(`/billing/invoices/${inv.id}`); }}
                                >
                                  <CreditCard size={12} className="mr-1" /> Payer
                                </Button>
                              )}
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground">
                                <Download size={16} />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  }
                  {!loading && filteredInvoices.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-16 text-muted-foreground">
                        Aucune facture{search ? ` pour "${search}"` : ''}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Devis */}
        <TabsContent value="quotes">
          <Card className="border-border shadow-sm">
            <CardContent className="p-0">
              <Table>
                <TableHeader className="bg-muted/50">
                  <TableRow>
                    <TableHead className="font-bold">Référence</TableHead>
                    <TableHead className="font-bold">Client</TableHead>
                    <TableHead className="font-bold">Date</TableHead>
                    <TableHead className="font-bold">Total TTC</TableHead>
                    <TableHead className="font-bold">Statut</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading
                    ? Array.from({ length: 4 }).map((_, i) => (
                      <TableRow key={i}>
                        {Array.from({ length: 6 }).map((_, j) => (
                          <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>
                        ))}
                      </TableRow>
                    ))
                    : filteredQuotes.map(q => {
                      const st = QUOTE_STATUS[q.status] ?? { label: q.status, color: '' };
                      return (
                        <TableRow
                          key={q.id}
                          className="hover:bg-muted/50 cursor-pointer"
                          onClick={() => router.push(`/billing/quotes/${q.id}`)}
                        >
                          <TableCell className="font-mono text-xs font-bold">{q.reference}</TableCell>
                          <TableCell>
                            <p className="font-medium text-foreground">{customerName(q.customer)}</p>
                            <p className="text-xs text-muted-foreground">{q.serviceOrder?.reference}</p>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {new Date(q.createdAt).toLocaleDateString('fr-FR')}
                          </TableCell>
                          <TableCell className="font-mono text-sm font-bold">{formatXAF(q.totalXaf)}</TableCell>
                          <TableCell>
                            <Badge className={cn("text-[10px] border-none", st.color)}>{st.label}</Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              {q.status === 'APPROVED' && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-7 px-2 text-[10px] border-brand text-brand hover:bg-brand hover:text-white"
                                  onClick={e => { e.stopPropagation(); router.push(`/billing/quotes/${q.id}`); }}
                                >
                                  <ArrowUpRight size={12} className="mr-1" /> Facturer
                                </Button>
                              )}
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground">
                                <MoreVertical size={16} />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  }
                  {!loading && filteredQuotes.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-16 text-muted-foreground">
                        Aucun devis{search ? ` pour "${search}"` : ''}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
