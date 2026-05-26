'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Car, User, Calendar, History, ArrowLeft, Wrench, FileText, Settings, ShieldCheck, Gauge } from "lucide-react";
import { vehiclesApi } from "@/lib/api";
import { loadReceptionDraft, type ReceptionDraft } from "@/lib/reception-draft";
import { useApi } from "@/hooks/use-api";
import { useAuth } from "@/contexts/auth-context";
import { WORKSHOP_STATUS } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { VehicleForm } from "@/components/forms/VehicleForm";

const FUEL_LABELS: Record<string, string> = {
  PETROL:   'Essence',
  DIESEL:   'Diesel',
  HYBRID:   'Hybride',
  ELECTRIC: 'Électrique',
  LPG:      'GPL',
};

function vehicleName(v: any): string {
  return [v?.make?.name, v?.model?.name].filter(Boolean).join(' ') || 'Véhicule';
}

function ownerName(c: any): string {
  if (!c) return '—';
  if (c.customerType === 'COMPANY') return c.companyName || '—';
  return [c.firstName, c.lastName].filter(Boolean).join(' ') || '—';
}

export default function VehicleDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const { hasRole, hasPermission } = useAuth();
  const canEdit     = hasRole('ADMIN') || hasRole('CHEF_ATELIER') || hasRole('RECEPTIONNISTE');
  const canCreateOT = hasPermission('ORD_CREATE');
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [pendingReception, setPendingReception] = useState(false);
  const [receptionDraft, setReceptionDraft] = useState<ReceptionDraft | null>(null);

  useEffect(() => {
    const draft = loadReceptionDraft(id);
    setPendingReception(!!draft);
    setReceptionDraft(draft);
  }, [id]);

  const { data: vehicle, loading, refetch } = useApi(
    () => vehiclesApi.get(id) as Promise<any>,
    [id]
  );

  if (loading) return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Skeleton className="w-10 h-10 rounded-full" />
        <div className="space-y-2"><Skeleton className="h-6 w-48" /><Skeleton className="h-4 w-32" /></div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Skeleton className="h-80 rounded-xl" />
        <div className="lg:col-span-2"><Skeleton className="h-80 rounded-xl" /></div>
      </div>
    </div>
  );

  if (!vehicle) return (
    <div className="flex flex-col items-center justify-center py-20 gap-4">
      <Car size={48} className="text-muted-foreground" strokeWidth={1} />
      <p className="text-muted-foreground">Véhicule introuvable</p>
      <Button variant="outline" onClick={() => router.back()}>Retour</Button>
    </div>
  );

  const orders: any[] = vehicle.serviceOrders || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft size={20} />
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-foreground">{vehicleName(vehicle)}</h1>
              <Badge variant="outline" className="font-mono border-border">{vehicle.plateNumber}</Badge>
            </div>
            <p className="text-muted-foreground text-sm">
              Propriétaire :{' '}
              <button
                className="text-brand hover:underline"
                onClick={() => router.push(`/customers/${vehicle.customerId}`)}
              >
                {ownerName(vehicle.customer)}
              </button>
            </p>
          </div>
        </div>
        <div className="flex gap-3">
          {canEdit && (
            <Button variant="outline" className="gap-2 border-border" onClick={() => setIsEditOpen(true)}>
              <Settings size={18} />
              Modifier
            </Button>
          )}
          {canCreateOT && (
            <Button
              className={cn(
                'gap-2',
                pendingReception
                  ? 'bg-amber-500 hover:bg-amber-600 text-white'
                  : 'bg-brand hover:bg-brand-hover',
              )}
              onClick={() => router.push(`/vehicles/${id}/reception`)}
            >
              <Wrench size={18} />
              {pendingReception ? 'Reprendre la réception' : 'Réceptionner'}
            </Button>
          )}
        </div>
      </div>

      {pendingReception && canCreateOT && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">
              Réception en cours
            </p>
            <p className="text-xs text-amber-700/80 dark:text-amber-400/80 mt-0.5">
              Brouillon sauvegardé
              {receptionDraft?.step === 2 ? ' — étape contrôle réception' : ' — étape ordre de travail'}
            </p>
          </div>
          <Button
            className="bg-brand hover:bg-brand-hover gap-2 shrink-0"
            onClick={() => router.push(`/vehicles/${id}/reception`)}
          >
            <Wrench size={16} />
            Reprendre la réception
          </Button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Specs */}
        <Card className="border-border shadow-sm overflow-hidden">
          <div className="h-32 bg-muted flex items-center justify-center">
            <Car size={64} className="text-muted-foreground/30" />
          </div>
          <CardContent className="p-6 space-y-6">
            <div className="grid grid-cols-2 gap-4">
              {[
                { label: 'Marque', value: vehicle.make?.name || '—' },
                { label: 'Modèle', value: vehicle.model?.name || '—' },
                { label: 'Année', value: vehicle.year?.toString() || '—' },
                { label: 'Carburant', value: FUEL_LABELS[vehicle.fuelType] || vehicle.fuelType || '—' },
              ].map(({ label, value }) => (
                <div key={label} className="space-y-1">
                  <p className="text-xs text-muted-foreground uppercase font-bold tracking-wider">{label}</p>
                  <p className="font-medium text-foreground">{value}</p>
                </div>
              ))}
            </div>

            {vehicle.currentMileage && (
              <div className="pt-4 border-t border-border flex items-center gap-2 text-foreground">
                <Gauge size={16} className="text-muted-foreground" />
                <span className="font-medium">{vehicle.currentMileage.toLocaleString()} km</span>
              </div>
            )}

            {vehicle.vin && (
              <div className="space-y-1 pt-4 border-t border-border">
                <p className="text-xs text-muted-foreground uppercase font-bold tracking-wider flex items-center gap-1">
                  <ShieldCheck size={12} /> VIN
                </p>
                <p className="font-mono text-sm font-bold text-foreground break-all bg-muted p-2 rounded">
                  {vehicle.vin}
                </p>
              </div>
            )}

            <div className="pt-4 border-t border-border">
              <p className="text-xs text-muted-foreground uppercase font-bold tracking-wider flex items-center gap-1 mb-2">
                <User size={12} /> Propriétaire
              </p>
              <Button
                variant="link"
                className="p-0 h-auto text-brand font-bold"
                onClick={() => router.push(`/customers/${vehicle.customerId}`)}
              >
                {ownerName(vehicle.customer)}
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="lg:col-span-2 space-y-6">
          {/* Historique OT */}
          <Card className="border-border shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg font-bold flex items-center gap-2">
                <History size={20} className="text-brand" />
                Historique des interventions ({orders.length})
              </CardTitle>
              <CardDescription>Toutes les réparations effectuées sur ce véhicule</CardDescription>
            </CardHeader>
            <CardContent>
              {orders.length === 0
                ? <div className="flex flex-col items-center gap-2 py-8 text-muted-foreground">
                  <FileText size={36} strokeWidth={1} />
                  <p className="text-sm">Aucun historique disponible</p>
                </div>
                : <Table>
                  <TableHeader className="bg-muted/50">
                    <TableRow>
                      <TableHead className="font-bold">Référence</TableHead>
                      <TableHead className="font-bold">Date</TableHead>
                      <TableHead className="font-bold">Plainte</TableHead>
                      <TableHead className="font-bold">Statut</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {orders.map(o => {
                      const st = WORKSHOP_STATUS[o.status] ?? { label: o.status, color: '', dot: '' };
                      return (
                        <TableRow
                          key={o.id}
                          className="cursor-pointer hover:bg-muted/50"
                          onClick={() => router.push(`/workshop/${o.id}`)}
                        >
                          <TableCell className="font-mono text-xs font-bold">{o.reference}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {new Date(o.openedAt).toLocaleDateString('fr-FR')}
                          </TableCell>
                          <TableCell className="max-w-[200px] truncate text-sm text-muted-foreground">
                            {o.clientComplaint}
                          </TableCell>
                          <TableCell>
                            <Badge className={cn("text-[10px] px-1.5 border-none", st.color)}>
                              {st.label}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              }
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card className="border-border shadow-sm bg-blue-500/5">
              <CardContent className="p-4 flex gap-4">
                <div className="w-10 h-10 rounded-full bg-blue-500/10 text-blue-500 flex items-center justify-center shrink-0">
                  <Calendar size={20} />
                </div>
                <div>
                  <p className="text-sm font-bold text-foreground">Prochaine révision</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {vehicle.lastServiceAt
                      ? `Dernière visite : ${new Date(vehicle.lastServiceAt).toLocaleDateString('fr-FR')}`
                      : 'Aucune visite enregistrée'}
                  </p>
                </div>
              </CardContent>
            </Card>
            <Card className="border-border shadow-sm bg-green-500/5">
              <CardContent className="p-4 flex gap-4">
                <div className="w-10 h-10 rounded-full bg-green-500/10 text-green-500 flex items-center justify-center shrink-0">
                  <ShieldCheck size={20} />
                </div>
                <div>
                  <p className="text-sm font-bold text-foreground">VIN vérifié</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {vehicle.vin ? vehicle.vin : 'Non renseigné'}
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {canEdit && (
        <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Modifier le véhicule</DialogTitle>
            </DialogHeader>
            <VehicleForm
              vehicleId={id}
              initialData={{
                plateNumber:    vehicle?.plateNumber    ?? '',
                makeId:         vehicle?.makeId         ?? '',
                modelId:        vehicle?.modelId        ?? '',
                year:           vehicle?.year           ?? new Date().getFullYear(),
                fuelType:       vehicle?.fuelType       ?? '',
                vin:            vehicle?.vin            ?? '',
                currentMileage: vehicle?.currentMileage ?? 0,
              }}
              onSuccess={() => { setIsEditOpen(false); refetch(); }}
            />
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
