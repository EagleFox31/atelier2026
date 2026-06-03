'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search, ArrowUpRight, ArrowDownLeft, RefreshCcw, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { stockApi, handleApiError } from "@/lib/api";

const MOVEMENT_TYPES: Record<string, { label: string; icon: typeof ArrowDownLeft; color: string; sign: string }> = {
  PURCHASE:      { label: 'Achat',        icon: ArrowDownLeft, color: 'bg-green-100 text-green-600',  sign: '+' },
  OT_CONSUMPTION:{ label: 'Conso. OT',   icon: ArrowUpRight,  color: 'bg-brand-light text-brand',    sign: '-' },
  ASP_PURCHASE:  { label: 'ASP',          icon: ArrowDownLeft, color: 'bg-indigo-100 text-indigo-600', sign: '+/-' },
  COUNTER_SALE:  { label: 'Vente',        icon: ArrowUpRight,  color: 'bg-orange-100 text-orange-600', sign: '-' },
  RETURN:        { label: 'Retour',       icon: ArrowDownLeft, color: 'bg-teal-100 text-teal-600',    sign: '+' },
  ADJUSTMENT:    { label: 'Ajustement',   icon: RefreshCcw,    color: 'bg-amber-100 text-amber-600',  sign: '±' },
  TRANSFER:      { label: 'Transfert',    icon: RefreshCcw,    color: 'bg-purple-100 text-purple-600', sign: '±' },
};

export default function StockMovementsPage() {
  const [search, setSearch] = useState('');
  const [movements, setMovements] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await stockApi.listMovements() as any[];
      setMovements(data);
    } catch (err: unknown) {
      handleApiError(err, 'Impossible de charger les mouvements');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = movements.filter(m => {
    const q = search.toLowerCase();
    return (
      m.part?.nameFr?.toLowerCase().includes(q) ||
      m.part?.reference?.toLowerCase().includes(q) ||
      m.serviceOrder?.reference?.toLowerCase().includes(q) ||
      m.movementType?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Historique des Mouvements</h1>
          <p className="text-muted-foreground">Entrées, sorties et ajustements de stock</p>
        </div>
        <Button variant="outline" className="gap-2 border-border" onClick={load}>
          <RefreshCw size={16} /> Actualiser
        </Button>
      </div>

      <Card className="border-border shadow-sm">
        <CardHeader>
          <div className="relative w-full md:w-96">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
            <Input
              placeholder="Pièce, référence OT, type..."
              className="pl-10 bg-muted border-border"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-xl border border-border overflow-hidden">
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow>
                  <TableHead className="font-bold">Type</TableHead>
                  <TableHead className="font-bold">Date</TableHead>
                  <TableHead className="font-bold">Pièce</TableHead>
                  <TableHead className="font-bold">Qté</TableHead>
                  <TableHead className="font-bold">Stock avant → après</TableHead>
                  <TableHead className="font-bold">OT lié</TableHead>
                  <TableHead className="font-bold">Opérateur</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading
                  ? Array.from({ length: 8 }).map((_, i) => (
                    <TableRow key={i}>
                      {Array.from({ length: 7 }).map((__, j) => (
                        <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>
                      ))}
                    </TableRow>
                  ))
                  : filtered.length === 0
                  ? <TableRow>
                    <TableCell colSpan={7} className="text-center py-16 text-muted-foreground">
                      Aucun mouvement{search ? ` pour "${search}"` : ''}
                    </TableCell>
                  </TableRow>
                  : filtered.map(m => {
                    const type = MOVEMENT_TYPES[m.movementType] ?? {
                      label: m.movementType, icon: RefreshCcw,
                      color: 'bg-muted text-muted-foreground', sign: '?'
                    };
                    const Icon = type.icon;
                    const qty = Number(m.quantity);
                    return (
                      <TableRow key={m.id} className="hover:bg-muted/30 transition-colors">
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div className={cn("p-1.5 rounded-lg", type.color)}>
                              <Icon size={14} />
                            </div>
                            <span className="text-xs font-bold">{type.label}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {new Date(m.performedAt).toLocaleString('fr-FR')}
                        </TableCell>
                        <TableCell>
                          <p className="font-medium text-foreground text-sm">{m.part?.nameFr}</p>
                          <p className="text-[10px] font-mono text-muted-foreground">{m.part?.reference}</p>
                        </TableCell>
                        <TableCell>
                          <span className={cn("font-bold text-sm", qty > 0 ? 'text-green-600' : 'text-red-600')}>
                            {qty > 0 ? `+${qty}` : qty}
                          </span>
                        </TableCell>
                        <TableCell className="text-xs font-mono text-muted-foreground">
                          {Number(m.qtyBefore)} → {Number(m.qtyAfter)}
                        </TableCell>
                        <TableCell>
                          {m.serviceOrder
                            ? <span className="text-xs font-mono text-brand">{m.serviceOrder.reference}</span>
                            : <span className="text-xs text-muted-foreground">—</span>
                          }
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {m.performer
                            ? `${m.performer.firstName} ${m.performer.lastName}`
                            : 'Système'}
                        </TableCell>
                      </TableRow>
                    );
                  })
                }
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
