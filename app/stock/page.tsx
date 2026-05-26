'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from "@/components/ui/table";
import {
  Plus, Search, AlertTriangle, Package, ArrowDown, ArrowUp,
  RefreshCw, AlertCircle
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger
} from "@/components/ui/dialog";
import { PartForm } from "@/components/forms/PartForm";
import { StockReceptionForm } from "@/components/forms/StockReceptionForm";
import { useRouter } from "next/navigation";
import { stockApi } from "@/lib/api";
import { useAuth } from "@/contexts/auth-context";
import { Skeleton } from "@/components/ui/skeleton";

interface Part {
  id: string;
  reference: string;
  nameFr: string;
  category: string;
  salePriceXaf: number;
  qtyAvailable: number;
  minThreshold: number;
  supplier?: { name: string };
}

interface StockSummary {
  lowStockCount: number;
  totalParts: number;
}

export default function StockPage() {
  const router = useRouter();
  const { hasPermission } = useAuth();
  const canManageStock = hasPermission('STK_CREATE');
  const [search, setSearch] = useState('');
  const [parts, setParts] = useState<Part[]>([]);
  const [summary, setSummary] = useState<StockSummary>({ lowStockCount: 0, totalParts: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [isPartModalOpen, setIsPartModalOpen] = useState(false);
  const [isReceptionModalOpen, setIsReceptionModalOpen] = useState(false);

  const fetchParts = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const data = await stockApi.listParts({ search: search || undefined }) as Part[];
      setParts(data);
      const lowCount = data.filter(p => Number(p.qtyAvailable) <= Number(p.minThreshold)).length;
      setSummary({ lowStockCount: lowCount, totalParts: data.length });
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    const t = setTimeout(fetchParts, 300);
    return () => clearTimeout(t);
  }, [fetchParts]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Stock & Pièces</h1>
          <p className="text-muted-foreground">Gérez votre inventaire et vos approvisionnements</p>
        </div>
        {canManageStock && (
          <div className="flex gap-3">
            <Dialog open={isReceptionModalOpen} onOpenChange={open => { setIsReceptionModalOpen(open); if (!open) fetchParts(); }}>
              <DialogTrigger render={
                <Button variant="outline" className="gap-2">
                  <ArrowDown size={18} />
                  Réception
                </Button>
              } />
              <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                  <DialogTitle>Réception de stock</DialogTitle>
                </DialogHeader>
                <StockReceptionForm onSuccess={() => setIsReceptionModalOpen(false)} />
              </DialogContent>
            </Dialog>
            <Dialog open={isPartModalOpen} onOpenChange={open => { setIsPartModalOpen(open); if (!open) fetchParts(); }}>
              <DialogTrigger render={
                <Button className="bg-brand hover:bg-brand-hover gap-2">
                  <Plus size={18} />
                  Nouvelle Pièce
                </Button>
              } />
              <DialogContent className="sm:max-w-[600px]">
                <DialogHeader>
                  <DialogTitle>Ajouter une nouvelle référence</DialogTitle>
                </DialogHeader>
                <PartForm onSuccess={() => setIsPartModalOpen(false)} />
              </DialogContent>
            </Dialog>
          </div>
        )}
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-6">
        <Card className="border-none shadow-sm bg-amber-50/80 dark:bg-amber-950/20 border-l-4 border-l-amber-500">
          <CardContent className="p-3 md:p-6 flex flex-col md:flex-row items-start md:items-center gap-2 md:gap-4">
            <div className="p-2 md:p-3 bg-amber-100 dark:bg-amber-900/40 rounded-xl text-amber-600 shrink-0">
              <AlertTriangle size={20} className="md:w-6 md:h-6" />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] md:text-sm font-medium text-amber-700 dark:text-amber-400 leading-tight">Seuil critique</p>
              <p className="text-xl md:text-2xl font-bold text-foreground">
                {loading ? <Skeleton className="h-7 w-12 inline-block" /> : `${summary.lowStockCount} pièces`}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-none shadow-sm bg-blue-50/80 dark:bg-blue-950/20 border-l-4 border-l-blue-500">
          <CardContent className="p-3 md:p-6 flex flex-col md:flex-row items-start md:items-center gap-2 md:gap-4">
            <div className="p-2 md:p-3 bg-blue-100 dark:bg-blue-900/40 rounded-xl text-blue-600 shrink-0">
              <Package size={20} className="md:w-6 md:h-6" />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] md:text-sm font-medium text-blue-700 dark:text-blue-400 leading-tight">Références</p>
              <p className="text-xl md:text-2xl font-bold text-foreground">
                {loading ? <Skeleton className="h-7 w-12 inline-block" /> : summary.totalParts}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-none shadow-sm bg-green-50/80 dark:bg-green-950/20 border-l-4 border-l-green-500 col-span-2 md:col-span-1">
          <CardContent className="p-3 md:p-6 flex flex-col md:flex-row items-start md:items-center gap-2 md:gap-4">
            <div className="p-2 md:p-3 bg-green-100 dark:bg-green-900/40 rounded-xl text-green-600 shrink-0">
              <ArrowUp size={20} className="md:w-6 md:h-6" />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] md:text-sm font-medium text-green-700 dark:text-green-400 leading-tight">Stock normal</p>
              <p className="text-xl md:text-2xl font-bold text-foreground">
                {loading ? <Skeleton className="h-7 w-12 inline-block" /> : summary.totalParts - summary.lowStockCount}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Table */}
      <Card className="border-none shadow-sm">
        <CardHeader>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="relative w-full md:w-96">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
              <Input
                placeholder="Rechercher une pièce..."
                className="pl-10"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            <Button variant="outline" size="sm" onClick={fetchParts} className="gap-2 shrink-0">
              <RefreshCw size={14} /> Actualiser
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {error ? (
            <div className="flex flex-col items-center gap-3 py-12 text-muted-foreground">
              <AlertCircle className="text-red-500" size={32} />
              <p className="text-sm">Impossible de charger les pièces.</p>
              <Button variant="outline" size="sm" onClick={fetchParts} className="gap-2">
                <RefreshCw size={14} /> Réessayer
              </Button>
            </div>
          ) : (
            <div className="rounded-xl border border-border overflow-hidden">
              <Table>
                <TableHeader className="bg-muted/50">
                  <TableRow>
                    <TableHead className="font-bold">Référence</TableHead>
                    <TableHead className="font-bold">Désignation</TableHead>
                    <TableHead className="font-bold">Catégorie</TableHead>
                    <TableHead className="font-bold">Prix Unitaire</TableHead>
                    <TableHead className="font-bold">Quantité</TableHead>
                    <TableHead className="font-bold">Statut</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    Array.from({ length: 6 }).map((_, i) => (
                      <TableRow key={i}>
                        {Array.from({ length: 6 }).map((__, j) => (
                          <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>
                        ))}
                      </TableRow>
                    ))
                  ) : parts.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                        Aucune pièce trouvée.
                      </TableCell>
                    </TableRow>
                  ) : (
                    parts.map(part => {
                      const isLow = Number(part.qtyAvailable) <= Number(part.minThreshold);
                      return (
                        <TableRow
                          key={part.id}
                          className="hover:bg-muted/30 transition-colors cursor-pointer"
                          onClick={() => router.push(`/stock/${part.id}`)}
                        >
                          <TableCell className="font-mono text-xs font-bold text-muted-foreground">
                            {part.reference}
                          </TableCell>
                          <TableCell className="font-medium text-foreground">{part.nameFr}</TableCell>
                          <TableCell>
                            <Badge variant="secondary" className="bg-muted text-muted-foreground border-none">
                              {part.category}
                            </Badge>
                          </TableCell>
                          <TableCell className="font-mono text-sm">
                            {Number(part.salePriceXaf).toLocaleString('fr-FR')} XAF
                          </TableCell>
                          <TableCell>
                            <span className={cn("font-bold", isLow ? "text-red-600" : "text-foreground")}>
                              {Number(part.qtyAvailable)}
                            </span>
                            <span className="text-xs text-muted-foreground ml-1">/ {Number(part.minThreshold)} min</span>
                          </TableCell>
                          <TableCell>
                            {isLow ? (
                              <Badge className="bg-red-50 text-red-700 dark:bg-red-950/30 border-none">Réappro.</Badge>
                            ) : (
                              <Badge className="bg-green-50 text-green-700 dark:bg-green-950/30 border-none">En stock</Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
