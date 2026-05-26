'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Plus, Search, Filter, MoreVertical, Car, History, ExternalLink, Wrench } from "lucide-react";
import { useRouter } from "next/navigation";
import { VehicleForm } from "@/components/forms/VehicleForm";
import { vehiclesApi, handleApiError } from "@/lib/api";
import { useAuth } from "@/contexts/auth-context";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import type { AppRouterInstance } from 'next/dist/shared/lib/app-router-context.shared-runtime';

function vehicleName(v: any): string {
  return [v.make?.name, v.model?.name].filter(Boolean).join(' ') || 'Véhicule inconnu';
}

function ownerName(v: any): string {
  const c = v.customer;
  if (!c) return '—';
  return c.customerType === 'COMPANY'
    ? (c.companyName || '—')
    : [c.firstName, c.lastName].filter(Boolean).join(' ') || '—';
}

function makeColumns(router: AppRouterInstance): DataTableColumn[] {
  return [
    {
      key: 'vehicle',
      label: 'Véhicule',
      sortable: true,
      sortValue: (v) => vehicleName(v),
      render: (v) => (
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center text-muted-foreground shrink-0">
            <Car size={18} />
          </div>
          <div>
            <p className="font-semibold text-foreground leading-tight">{vehicleName(v)}</p>
            <p className="text-xs text-muted-foreground">{v.year ? `Année ${v.year}` : '—'}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'plateNumber',
      label: 'Immatriculation',
      sortable: true,
      headerClassName: 'w-36',
      render: (v) => (
        <Badge variant="outline" className="font-mono border-border">{v.plateNumber}</Badge>
      ),
    },
    {
      key: 'customer',
      label: 'Client',
      sortable: true,
      sortValue: (v) => ownerName(v),
      render: (v) => (
        <span
          className="text-sm text-foreground hover:text-brand cursor-pointer"
          onClick={e => { e.stopPropagation(); router.push(`/customers/${v.customerId}`); }}
        >
          {ownerName(v)}
        </span>
      ),
    },
    {
      key: 'currentMileage',
      label: 'Kilométrage',
      sortable: true,
      headerClassName: 'w-36',
      render: (v) => (
        <span className="text-sm text-muted-foreground tabular-nums">
          {v.currentMileage ? `${v.currentMileage.toLocaleString()} km` : '—'}
        </span>
      ),
    },
    {
      key: 'lastServiceAt',
      label: 'Dernière visite',
      sortable: true,
      sortValue: (v) => v.lastServiceAt ? new Date(v.lastServiceAt) : null,
      headerClassName: 'w-40',
      render: (v) => (
        <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <History size={13} className="shrink-0" />
          {v.lastServiceAt ? new Date(v.lastServiceAt).toLocaleDateString('fr-FR') : 'Jamais'}
        </div>
      ),
    },
    {
      key: 'actions',
      label: '',
      headerClassName: 'w-12',
      render: (v) => (
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground"
                onClick={e => e.stopPropagation()}>
                <MoreVertical size={18} />
              </Button>
            }
          />
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem className="gap-2" onSelect={() => router.push(`/vehicles/${v.id}`)}>
              <ExternalLink size={16} /> Voir la fiche
            </DropdownMenuItem>
            <DropdownMenuItem className="gap-2" onSelect={() => router.push(`/vehicles/${v.id}/reception`)}>
              <Wrench size={16} /> Réceptionner
            </DropdownMenuItem>
            <DropdownMenuItem className="gap-2" onSelect={() => router.push(`/vehicles/${v.id}`)}>
              <History size={16} /> Historique
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];
}

export default function VehiclesPage() {
  const router  = useRouter();
  const { hasPermission } = useAuth();
  const canCreateVehicle = hasPermission('VEH_CREATE');
  const columns = React.useMemo(() => makeColumns(router), [router]);

  const [search, setSearch]       = useState('');
  const [vehicles, setVehicles]   = useState<any[]>([]);
  const [loading, setLoading]     = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await vehiclesApi.list({ search: search || undefined });
      setVehicles(data as any[]);
    } catch (err: unknown) {
      handleApiError(err, 'Impossible de charger les véhicules');
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
          <h1 className="text-2xl font-bold text-foreground">Véhicules</h1>
          <p className="text-muted-foreground">Gérez le parc automobile de vos clients</p>
        </div>
        <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
          {canCreateVehicle && (
            <DialogTrigger render={
              <Button className="bg-brand hover:bg-brand-hover gap-2">
                <Plus size={18} />
                Nouveau Véhicule
              </Button>
            } />
          )}
          <DialogContent className="sm:max-w-[600px] bg-card border-border">
            <DialogHeader>
              <DialogTitle>Enregistrer un nouveau véhicule</DialogTitle>
            </DialogHeader>
            <VehicleForm onSuccess={() => { setIsModalOpen(false); load(); }} />
          </DialogContent>
        </Dialog>
      </div>

      <Card className="border-border shadow-sm">
        <CardHeader className="pb-0">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="relative w-full md:w-96">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
              <Input
                placeholder="Immatriculation, marque, client..."
                className="pl-10 bg-muted border-border"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            <Button variant="outline" size="sm" className="gap-2 border-border">
              <Filter size={16} />
              Filtres
            </Button>
          </div>
        </CardHeader>
        <CardContent className="pt-4 px-0 pb-0">
          <DataTable
            columns={columns}
            data={vehicles}
            loading={loading}
            skeletonRows={8}
            keyExtractor={(v) => v.id}
            onRowClick={(v) => router.push(`/vehicles/${v.id}`)}
            emptyMessage={search ? `Aucun véhicule pour "${search}"` : 'Aucun véhicule enregistré'}
            emptyIcon={<Car size={40} strokeWidth={1} />}
          />
        </CardContent>
      </Card>
    </div>
  );
}
