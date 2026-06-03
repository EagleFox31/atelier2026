'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { WORKSHOP_STATUS } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { Plus, Clock, User, Car, Wrench } from "lucide-react";
import { cn } from "@/lib/utils";
import { workshopApi, handleApiError } from "@/lib/api";
import { OrderForm } from "@/components/forms/OrderForm";
import { useRouter } from "next/navigation";
import type { AppRouterInstance } from 'next/dist/shared/lib/app-router-context.shared-runtime';
import { useAuth } from "@/contexts/auth-context";
import { isTechnicianProfile } from "@/lib/role-routing";
import { scopeOrdersForUser } from "@/lib/workshop-orders";
import { useRealtimeEvents } from "@/hooks/use-realtime-events";

// ─── Constantes ───────────────────────────────────────────────────────────────

const PRIORITY_STYLE: Record<string, string> = {
  URGENT: 'bg-red-500/10 text-red-600 border-red-200',
  HIGH:   'bg-orange-500/10 text-orange-600 border-orange-200',
  NORMAL: 'bg-brand/10 text-brand border-brand/20',
  LOW:    'bg-slate-500/10 text-slate-500 border-slate-200',
};

const PRIORITY_LABEL: Record<string, string> = {
  URGENT: 'Urgent', HIGH: 'Haute', NORMAL: 'Normal', LOW: 'Faible',
};

const PRIORITY_ORDER: Record<string, number> = {
  URGENT: 0, HIGH: 1, NORMAL: 2, LOW: 3,
};

const RECEPTION_STATUSES = ['DRAFT', 'RECEIVED'];
const DIAG_STATUSES      = ['DIAGNOSING', 'QUOTE_PENDING', 'QUOTE_APPROVED'];
const WORK_STATUSES      = ['IN_PROGRESS', 'QC_PENDING', 'QC_REJECTED', 'QC_DONE'];
const READY_STATUSES     = ['READY', 'INVOICED'];
const CLOSED_STATUSES    = ['CLOSED', 'CANCELLED'];

function vehicleName(v: any): string {
  return [v?.make?.name, v?.model?.name].filter(Boolean).join(' ') || 'Véhicule';
}

// ─── Colonnes ─────────────────────────────────────────────────────────────────

function makeColumns(router: AppRouterInstance): DataTableColumn[] {
  return [
    {
      key: 'priority',
      label: 'Priorité',
      sortable: true,
      sortValue: (o) => PRIORITY_ORDER[o.priority] ?? 99,
      headerClassName: 'w-24',
      render: (o) => (
        <Badge className={cn('border text-[10px] font-bold whitespace-nowrap', PRIORITY_STYLE[o.priority] ?? PRIORITY_STYLE.NORMAL)}>
          {PRIORITY_LABEL[o.priority] ?? o.priority}
        </Badge>
      ),
    },
    {
      key: 'reference',
      label: 'Référence',
      sortable: true,
      headerClassName: 'w-32',
      render: (o) => (
        <span className="font-mono text-xs text-muted-foreground">{o.reference}</span>
      ),
    },
    {
      key: 'vehicle',
      label: 'Véhicule',
      sortable: true,
      sortValue: (o) => vehicleName(o.vehicle),
      render: (o) => (
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-brand/10 flex items-center justify-center shrink-0">
            <Car size={14} className="text-brand" />
          </div>
          <div>
            <p className="text-sm font-bold text-foreground leading-tight">{vehicleName(o.vehicle)}</p>
            <p className="text-[10px] font-mono text-muted-foreground">{o.vehicle?.plateNumber}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'clientComplaint',
      label: 'Plainte client',
      className: 'max-w-[220px]',
      render: (o) => (
        <span className="text-sm text-muted-foreground truncate block max-w-[220px]" title={o.clientComplaint}>
          {o.clientComplaint}
        </span>
      ),
    },
    {
      key: 'chef',
      label: 'Chef assigné',
      sortable: true,
      sortValue: (o) => o.chef ? `${o.chef.firstName} ${o.chef.lastName}` : '',
      render: (o) => (
        o.chef ? (
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-emerald-500/10 flex items-center justify-center text-[10px] font-bold text-emerald-600 shrink-0">
              {o.chef.firstName[0]}{o.chef.lastName[0]}
            </div>
            <span className="text-sm text-foreground">{o.chef.firstName} {o.chef.lastName}</span>
          </div>
        ) : (
          <span className="text-xs italic text-muted-foreground/50">Non assigné</span>
        )
      ),
    },
    {
      key: 'status',
      label: 'Statut',
      sortable: true,
      sortValue: (o) => o.status,
      render: (o) => {
        const st = WORKSHOP_STATUS[o.status] ?? { label: o.status, dot: 'bg-slate-400' };
        return (
          <div className="flex items-center gap-2">
            <div className={cn('w-2 h-2 rounded-full shrink-0', st.dot)} />
            <span className="text-xs font-semibold text-muted-foreground whitespace-nowrap">
              {st.label}
            </span>
          </div>
        );
      },
    },
    {
      key: 'openedAt',
      label: 'Ouverture',
      sortable: true,
      sortValue: (o) => new Date(o.openedAt),
      className: 'text-sm text-muted-foreground whitespace-nowrap',
      render: (o) => (
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <Clock size={13} className="shrink-0" />
          <span className="text-xs">{new Date(o.openedAt).toLocaleDateString('fr-FR')}</span>
        </div>
      ),
    },
  ];
}

// ─── Liste mobile (cards) ─────────────────────────────────────────────────────

function OtMobileList({
  orders,
  loading,
  onSelect,
  showChef = true,
}: {
  orders: any[];
  loading: boolean;
  onSelect: (o: any) => void;
  showChef?: boolean;
}) {
  if (loading) {
    return (
      <div className="md:hidden p-4 space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-32 w-full rounded-xl" />
        ))}
      </div>
    );
  }

  if (orders.length === 0) {
    return (
      <div className="md:hidden flex flex-col items-center gap-3 py-16 text-muted-foreground">
        <Wrench size={40} strokeWidth={1} />
        <p className="text-sm">Aucun ordre de travail dans cette catégorie</p>
      </div>
    );
  }

  return (
    <div className="md:hidden p-4 space-y-3">
      {orders.map((o) => {
        const st = WORKSHOP_STATUS[o.status] ?? { label: o.status, dot: 'bg-slate-400' };
        return (
          <Card
            key={o.id}
            className="border-border shadow-sm cursor-pointer active:scale-[0.99] transition-transform"
            onClick={() => onSelect(o)}
          >
            <CardContent className="p-4 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge className={cn('border text-[10px] font-bold', PRIORITY_STYLE[o.priority] ?? PRIORITY_STYLE.NORMAL)}>
                    {PRIORITY_LABEL[o.priority] ?? o.priority}
                  </Badge>
                  <div className="flex items-center gap-1.5">
                    <div className={cn('w-2 h-2 rounded-full shrink-0', st.dot)} />
                    <span className="text-xs font-semibold text-muted-foreground">
                      {st.label}
                    </span>
                  </div>
                </div>
                <span className="font-mono text-[10px] text-muted-foreground shrink-0">{o.reference}</span>
              </div>

              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-brand/10 flex items-center justify-center shrink-0">
                  <Car size={16} className="text-brand" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-bold text-sm truncate">{vehicleName(o.vehicle)}</p>
                  <p className="text-xs font-mono text-muted-foreground">{o.vehicle?.plateNumber}</p>
                </div>
              </div>

              {o.clientComplaint && (
                <p className="text-sm text-muted-foreground line-clamp-2">{o.clientComplaint}</p>
              )}

              <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground pt-1 border-t border-border/60">
                {showChef ? (
                  o.chef ? (
                    <div className="flex items-center gap-1.5 min-w-0">
                      <User size={12} className="shrink-0" />
                      <span className="truncate">{o.chef.firstName} {o.chef.lastName}</span>
                    </div>
                  ) : (
                    <span className="italic opacity-50">Non assigné</span>
                  )
                ) : (
                  <span />
                )}
                <div className="flex items-center gap-1 shrink-0">
                  <Clock size={12} />
                  {new Date(o.openedAt).toLocaleDateString('fr-FR')}
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function WorkshopPage() {
  const router = useRouter();
  const { user } = useAuth();
  const isTech = isTechnicianProfile(user);
  const columns = React.useMemo(() => makeColumns(router), [router]);

  const [activeTab, setActiveTab]   = useState('all');
  const [orders, setOrders]         = useState<any[]>([]);
  const [loading, setLoading]       = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await workshopApi.listOTs() as any[];
      setOrders(data);
    } catch (err: unknown) {
      handleApiError(err, 'Impossible de charger les OT');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  useRealtimeEvents({ onOtCreated: load, onOtStatusChanged: load });

  const myOrders = scopeOrdersForUser(orders, user);

  const filtered = myOrders.filter(o => {
    if (activeTab === 'reception') return RECEPTION_STATUSES.includes(o.status);
    if (activeTab === 'diag')      return DIAG_STATUSES.includes(o.status);
    if (activeTab === 'work')      return WORK_STATUSES.includes(o.status);
    if (activeTab === 'ready')     return READY_STATUSES.includes(o.status);
    if (activeTab === 'closed')    return CLOSED_STATUSES.includes(o.status);
    return !CLOSED_STATUSES.includes(o.status);
  });

  const countBy = (arr: string[]) => myOrders.filter(o => arr.includes(o.status)).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Atelier</h1>
          <p className="text-muted-foreground text-sm">Suivi des ordres de travail en temps réel</p>
        </div>
        <div className="flex gap-3">
{!isTech && (
            <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
              <DialogTrigger render={
                <Button className="bg-brand hover:bg-brand-hover gap-2">
                  <Plus size={16} />
                  Nouvel OT
                </Button>
              } />
              <DialogContent className="sm:max-w-[600px] bg-card border-border">
                <DialogHeader>
                  <DialogTitle>Ouvrir un nouvel Ordre de Travail</DialogTitle>
                </DialogHeader>
                <OrderForm onSuccess={() => { setIsModalOpen(false); load(); }} />
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>

      {/* Onglets + Tableau */}
      <Card className="rounded-2xl border-border shadow-sm overflow-hidden" data-tour="tour-workshop-new">
        <Tabs defaultValue="all" className="w-full" onValueChange={setActiveTab}>
          <div className="border-b border-border">
            <div className="overflow-x-auto scrollbar-hide">
              <TabsList className="bg-transparent p-0 gap-0 h-auto border-0 flex w-max min-w-full px-4 pt-3">
                {[
                  { value: 'all',       label: 'Tous',        shortLabel: 'Tous',    count: myOrders.filter(o => !CLOSED_STATUSES.includes(o.status)).length, color: 'border-brand text-brand' },
                  { value: 'reception', label: 'Réception',   shortLabel: 'Récept.', count: countBy(RECEPTION_STATUSES), color: 'border-amber-500 text-amber-600' },
                  { value: 'diag',      label: 'Diag. & Devis', shortLabel: 'Diag.',  count: countBy(DIAG_STATUSES),      color: 'border-orange-500 text-orange-600' },
                  { value: 'work',      label: 'Travaux',     shortLabel: 'Travaux', count: countBy(WORK_STATUSES),      color: 'border-violet-500 text-violet-600' },
                  { value: 'ready',     label: 'Prêt / Fact.', shortLabel: 'Prêt',   count: countBy(READY_STATUSES),     color: 'border-emerald-500 text-emerald-600' },
                  { value: 'closed',    label: 'Clôturés',    shortLabel: 'Clôt.',   count: countBy(CLOSED_STATUSES),    color: 'border-slate-400 text-slate-500' },
                ].map(tab => (
                  <TabsTrigger
                    key={tab.value}
                    value={tab.value}
                    className={`rounded-none border-b-2 border-transparent data-[state=active]:${tab.color} data-[state=active]:bg-transparent px-3 pb-3 font-medium whitespace-nowrap text-xs md:text-sm`}
                  >
                    <span className="md:hidden">{tab.shortLabel} ({tab.count})</span>
                    <span className="hidden md:inline">{tab.label} ({tab.count})</span>
                  </TabsTrigger>
                ))}
              </TabsList>
            </div>
          </div>

          <TabsContent value={activeTab} className="mt-0">
            <OtMobileList
              orders={filtered}
              loading={loading}
              onSelect={(o) => router.push(`/workshop/${o.id}`)}
              showChef={!isTech}
            />
            <div className="hidden md:block">
              <DataTable
                columns={columns}
                data={filtered}
                loading={loading}
                skeletonRows={8}
                keyExtractor={(o) => o.id}
                onRowClick={(o) => router.push(`/workshop/${o.id}`)}
                emptyMessage="Aucun ordre de travail dans cette catégorie"
                emptyIcon={<Wrench size={40} strokeWidth={1} />}
              />
            </div>
          </TabsContent>
        </Tabs>
      </Card>
    </div>
  );
}
