'use client';

import React from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowLeft, Package, History, AlertTriangle, ArrowUpRight, ArrowDownLeft, RefreshCcw, Edit } from "lucide-react";
import { stockApi } from "@/lib/api";
import { useAuth } from "@/contexts/auth-context";
import { useApi } from "@/hooks/use-api";
import { formatXAF, cn } from "@/lib/utils";

const MOVEMENT_TYPES: Record<string, { label: string; color: string }> = {
  PURCHASE:       { label: 'Achat',       color: 'text-green-600' },
  OT_CONSUMPTION: { label: 'Conso. OT',   color: 'text-blue-600' },
  ADJUSTMENT:     { label: 'Ajustement',  color: 'text-amber-600' },
  COUNTER_SALE:   { label: 'Vente',       color: 'text-orange-600' },
  RETURN:         { label: 'Retour',      color: 'text-teal-600' },
  ASP_PURCHASE:   { label: 'ASP',         color: 'text-indigo-600' },
};

export default function PartDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { hasPermission } = useAuth();
  const canManageStock = hasPermission('STK_CREATE');
  const id = params.id as string;

  const { data: part, loading } = useApi(
    () => stockApi.getPart(id) as Promise<any>,
    [id]
  );

  const { data: movements, loading: movLoading } = useApi(
    () => stockApi.listMovements({ partId: id }) as Promise<any[]>,
    [id]
  );

  if (loading) return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Skeleton className="w-10 h-10 rounded-full" />
        <div className="space-y-2"><Skeleton className="h-7 w-48" /><Skeleton className="h-4 w-32" /></div>
      </div>
      <div className="grid grid-cols-3 gap-6">
        {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
      </div>
    </div>
  );

  if (!part) return (
    <div className="flex flex-col items-center justify-center py-20 gap-4">
      <Package size={48} className="text-muted-foreground" strokeWidth={1} />
      <p className="text-muted-foreground">Pièce introuvable</p>
      <Button variant="outline" onClick={() => router.back()}>Retour</Button>
    </div>
  );

  const isLow    = Number(part.qtyAvailable) <= Number(part.minThreshold);
  const movsList = movements ?? [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft size={20} />
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-foreground">{part.nameFr}</h1>
              {isLow && (
                <Badge className="bg-red-50 text-red-600 border-none gap-1">
                  <AlertTriangle size={12} /> Seuil critique
                </Badge>
              )}
            </div>
            <p className="text-muted-foreground text-sm font-mono">{part.reference}</p>
          </div>
        </div>
        {canManageStock && (
          <Button variant="outline" className="gap-2 border-border">
            <Edit size={18} /> Modifier
          </Button>
        )}
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-6">
        <Card className={cn("border shadow-sm", isLow ? "border-red-200 bg-red-50/50" : "border-border")}>
          <CardContent className="p-3 md:p-5">
            <p className="text-[10px] md:text-xs font-bold text-muted-foreground uppercase tracking-wider">Disponible</p>
            <p className={cn("text-2xl md:text-3xl font-bold mt-1", isLow ? 'text-red-600' : 'text-foreground')}>
              {Number(part.qtyAvailable)}
            </p>
            <p className="text-xs text-muted-foreground mt-1">Seuil min : {Number(part.minThreshold)}</p>
          </CardContent>
        </Card>
        <Card className="border-border shadow-sm">
          <CardContent className="p-3 md:p-5">
            <p className="text-[10px] md:text-xs font-bold text-muted-foreground uppercase tracking-wider">En stock</p>
            <p className="text-2xl md:text-3xl font-bold mt-1 text-foreground">{Number(part.qtyInStock)}</p>
            <p className="text-xs text-muted-foreground mt-1">Réservé : {Number(part.qtyReserved)}</p>
          </CardContent>
        </Card>
        <Card className="border-border shadow-sm">
          <CardContent className="p-3 md:p-5">
            <p className="text-[10px] md:text-xs font-bold text-muted-foreground uppercase tracking-wider">Prix de vente</p>
            <p className="text-lg md:text-2xl font-bold mt-1 text-foreground">{formatXAF(part.salePriceXaf)}</p>
            {part.purchasePriceXaf && (
              <p className="text-xs text-muted-foreground mt-1">Achat : {formatXAF(part.purchasePriceXaf)}</p>
            )}
          </CardContent>
        </Card>
        <Card className="border-border shadow-sm">
          <CardContent className="p-3 md:p-5">
            <p className="text-[10px] md:text-xs font-bold text-muted-foreground uppercase tracking-wider">Catégorie</p>
            <Badge variant="secondary" className="mt-1 md:mt-2 text-xs md:text-sm">{part.category}</Badge>
            {part.supplier && (
              <p className="text-xs text-muted-foreground mt-2">{part.supplier.name}</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Infos */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="border-border shadow-sm">
          <CardHeader>
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <Package size={18} className="text-brand" /> Détails
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {[
              { label: 'Référence interne', value: part.reference },
              { label: 'Référence OEM',     value: part.oemReference || '—' },
              { label: 'Code-barres',       value: part.barcode || '—' },
              { label: 'Unité',             value: part.unit },
              { label: 'Emplacement',       value: part.storageLocation || '—' },
              { label: 'Consommable',       value: part.isConsumable ? 'Oui' : 'Non' },
            ].map(({ label, value }) => (
              <div key={label} className="flex justify-between">
                <span className="text-muted-foreground">{label}</span>
                <span className="font-medium text-foreground font-mono text-xs">{value}</span>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Mouvements */}
        <Card className="border-border shadow-sm lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <History size={18} className="text-brand" />
              Derniers mouvements ({movsList.length})
            </CardTitle>
            <CardDescription>Historique des entrées et sorties</CardDescription>
          </CardHeader>
          <CardContent>
            {movLoading
              ? <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-12 rounded-lg" />)}</div>
              : movsList.length === 0
              ? <p className="text-center py-8 text-muted-foreground text-sm">Aucun mouvement enregistré</p>
              : <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="font-bold">Type</TableHead>
                    <TableHead className="font-bold">Qté</TableHead>
                    <TableHead className="font-bold">Avant → Après</TableHead>
                    <TableHead className="font-bold">OT</TableHead>
                    <TableHead className="font-bold">Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {movsList.map((m: any) => {
                    const type = MOVEMENT_TYPES[m.movementType];
                    const qty  = Number(m.quantity);
                    return (
                      <TableRow key={m.id} className="hover:bg-muted/30">
                        <TableCell>
                          <div className="flex items-center gap-1.5">
                            {qty >= 0
                              ? <ArrowDownLeft size={14} className="text-green-500" />
                              : <ArrowUpRight  size={14} className="text-red-500" />
                            }
                            <span className="text-xs font-medium">{type?.label ?? m.movementType}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className={cn("font-bold text-sm", qty >= 0 ? 'text-green-600' : 'text-red-600')}>
                            {qty >= 0 ? `+${qty}` : qty}
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
                        <TableCell className="text-xs text-muted-foreground">
                          {new Date(m.performedAt).toLocaleDateString('fr-FR')}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            }
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
