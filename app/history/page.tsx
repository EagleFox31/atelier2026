'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { History, Search, Filter, Calendar, ChevronRight } from "lucide-react";
import { WORKSHOP_STATUS } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";
import { workshopApi, handleApiError } from "@/lib/api";

function vehicleName(v: any) {
  return [v?.make?.name, v?.model?.name].filter(Boolean).join(' ') || '—';
}
function customerName(c: any) {
  if (!c) return '—';
  return c.customerType === 'COMPANY'
    ? c.companyName
    : [c.firstName, c.lastName].filter(Boolean).join(' ');
}

export default function HistoryPage() {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await workshopApi.listOTs({ search: search || undefined }) as any[];
      setOrders(data);
    } catch (err: unknown) {
      handleApiError(err, 'Impossible de charger l\'historique');
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    const t = setTimeout(load, 300);
    return () => clearTimeout(t);
  }, [load]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Historique Global</h1>
          <p className="text-muted-foreground">Archives de toutes les interventions en atelier</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="gap-2 border-border"><Calendar size={18} /> Période</Button>
          <Button variant="outline" className="gap-2 border-border"><Filter size={18} /> Exporter</Button>
        </div>
      </div>

      <Card className="border-border shadow-sm">
        <CardHeader>
          <div className="relative w-full md:w-96">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
            <Input
              placeholder="Référence OT, immatriculation, client..."
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
                  <TableHead className="font-bold">Référence</TableHead>
                  <TableHead className="font-bold">Date</TableHead>
                  <TableHead className="font-bold">Véhicule</TableHead>
                  <TableHead className="font-bold">Client</TableHead>
                  <TableHead className="font-bold">Plainte</TableHead>
                  <TableHead className="font-bold">Statut</TableHead>
                  <TableHead className="w-8" />
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
                  : orders.length === 0
                  ? <TableRow>
                    <TableCell colSpan={7} className="text-center py-16 text-muted-foreground">
                      Aucun OT trouvé{search ? ` pour "${search}"` : ''}
                    </TableCell>
                  </TableRow>
                  : orders.map(o => {
                    const st = WORKSHOP_STATUS[o.status] ?? { label: o.status, color: '', dot: '' };
                    return (
                      <TableRow
                        key={o.id}
                        className="hover:bg-muted/50 cursor-pointer group"
                        onClick={() => router.push(`/workshop/${o.id}`)}
                      >
                        <TableCell className="font-mono text-xs font-bold text-muted-foreground">{o.reference}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {new Date(o.openedAt).toLocaleDateString('fr-FR')}
                        </TableCell>
                        <TableCell>
                          <p className="font-medium text-foreground text-sm">{vehicleName(o.vehicle)}</p>
                          <p className="text-[10px] font-mono text-muted-foreground">{o.vehicle?.plateNumber}</p>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">{customerName(o.customer)}</TableCell>
                        <TableCell className="max-w-[200px] truncate text-sm text-muted-foreground">
                          {o.clientComplaint}
                        </TableCell>
                        <TableCell>
                          <Badge className={cn("text-[10px] px-1.5 border-none", st.color)}>{st.label}</Badge>
                        </TableCell>
                        <TableCell>
                          <ChevronRight size={16} className="text-muted-foreground group-hover:text-brand transition-colors" />
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
