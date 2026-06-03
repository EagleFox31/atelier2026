'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Car, User, Calendar, History, ArrowLeft, Wrench, FileText, Settings, ShieldCheck, Gauge, Clock } from "lucide-react";
import { vehiclesApi } from "@/lib/api";
import { loadReceptionDraft, type ReceptionDraft } from "@/lib/reception-draft";
import { useApi } from "@/hooks/use-api";
import { useAuth } from "@/contexts/auth-context";
import { WORKSHOP_STATUS, MOBILE_BOTTOM_NAV_OFFSET } from "@/lib/constants";
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

function VehicleOtMobileList({
  orders,
  onSelect,
}: {
  orders: any[];
  onSelect: (id: string) => void;
}) {
  if (orders.length === 0) {
    return (
      <div className="md:hidden flex flex-col items-center gap-2 py-8 text-muted-foreground">
        <FileText size={36} strokeWidth={1} />
        <p className="text-sm">Aucun historique disponible</p>
      </div>
    );
  }

  return (
    <div className="md:hidden space-y-3">
      {orders.map(o => {
        const st = WORKSHOP_STATUS[o.status] ?? { label: o.status, color: '', dot: '' };
        return (
          <Card
            key={o.id}
            className="border-border shadow-sm cursor-pointer active:scale-[0.99] transition-transform overflow-hidden"
            onClick={() => onSelect(o.id)}
          >
            <CardContent className="p-0">
              <div className="flex items-center justify-between gap-2 px-4 py-2.5 border-b border-border/60 bg-muted/20">
                <span className="font-mono text-xs font-bold text-foreground">{o.reference}</span>
                <Badge className={cn('text-[10px] border-none shrink-0', st.color)}>{st.label}</Badge>
              </div>
              <div className="px-4 py-3 space-y-2">
                <p className="text-sm text-muted-foreground line-clamp-2">{o.clientComplaint}</p>
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Clock size={12} className="shrink-0" />
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

  const goReception = () => router.push(`/vehicles/${id}/reception`);
  const receptionLabel = pendingReception ? 'Reprendre la réception' : 'Réceptionner';

  if (loading) return (
    <div className="space-y-6 pb-24 md:pb-6">
      <div className="flex items-center gap-4">
        <Skeleton className="w-10 h-10 rounded-full shrink-0" />
        <div className="space-y-2 flex-1"><Skeleton className="h-6 w-48" /><Skeleton className="h-4 w-32" /></div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Skeleton className="h-72 rounded-xl" />
        <div className="lg:col-span-2"><Skeleton className="h-72 rounded-xl" /></div>
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
    <div className="space-y-6 pb-28 md:pb-6">
      {/* ── En-tête ── */}
      <div className="flex flex-col gap-4">
        <div className="flex items-start gap-3 min-w-0">
          <Button variant="ghost" size="icon" onClick={() => router.back()} className="shrink-0 -ml-1">
            <ArrowLeft size={20} />
          </Button>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-bold text-foreground leading-tight">
                {vehicleName(vehicle)}
              </h1>
              <Badge variant="outline" className="font-mono border-border text-sm shrink-0">
                {vehicle.plateNumber}
              </Badge>
            </div>
            <p className="text-muted-foreground text-sm mt-1">
              Propriétaire :{' '}
              <button
                type="button"
                className="text-brand hover:underline font-medium"
                onClick={() => router.push(`/customers/${vehicle.customerId}`)}
              >
                {ownerName(vehicle.customer)}
              </button>
            </p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 sm:justify-end">
          {canEdit && (
            <Button
              variant="outline"
              className="gap-2 border-border w-full sm:w-auto"
              onClick={() => setIsEditOpen(true)}
            >
              <Settings size={18} />
              Modifier
            </Button>
          )}
          {canCreateOT && (
            <Button
              className={cn(
                'gap-2 w-full sm:w-auto hidden md:inline-flex',
                pendingReception
                  ? 'bg-amber-500 hover:bg-amber-600 text-white'
                  : 'bg-brand hover:bg-brand-hover',
              )}
              onClick={goReception}
            >
              <Wrench size={18} />
              {receptionLabel}
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
            className="bg-brand hover:bg-brand-hover gap-2 shrink-0 w-full sm:w-auto md:hidden"
            onClick={goReception}
          >
            <Wrench size={16} />
            Reprendre
          </Button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Fiche technique */}
        <Card className="border-border shadow-sm overflow-hidden">
          <div className="h-24 sm:h-32 bg-muted flex items-center justify-center">
            <Car size={48} className="text-muted-foreground/30" />
          </div>
          <CardContent className="p-4 sm:p-6 space-y-5 sm:space-y-6">
            <div className="grid grid-cols-2 gap-4">
              {[
                { label: 'Marque', value: vehicle.make?.name || '—' },
                { label: 'Modèle', value: vehicle.model?.name || '—' },
                { label: 'Année', value: vehicle.year?.toString() || '—' },
                { label: 'Carburant', value: FUEL_LABELS[vehicle.fuelType] || vehicle.fuelType || '—' },
              ].map(({ label, value }) => (
                <div key={label} className="space-y-1">
                  <p className="text-[10px] sm:text-xs text-muted-foreground uppercase font-bold tracking-wider">{label}</p>
                  <p className="font-medium text-sm sm:text-base text-foreground">{value}</p>
                </div>
              ))}
            </div>

            {vehicle.currentMileage != null && vehicle.currentMileage > 0 && (
              <div className="pt-4 border-t border-border flex items-center gap-2 text-foreground">
                <Gauge size={16} className="text-muted-foreground shrink-0" />
                <span className="font-medium tabular-nums">{vehicle.currentMileage.toLocaleString()} km</span>
              </div>
            )}

            {vehicle.vin && (
              <div className="space-y-1 pt-4 border-t border-border">
                <p className="text-[10px] sm:text-xs text-muted-foreground uppercase font-bold tracking-wider flex items-center gap-1">
                  <ShieldCheck size={12} /> VIN
                </p>
                <p className="font-mono text-xs sm:text-sm font-bold text-foreground break-all bg-muted p-2 rounded">
                  {vehicle.vin}
                </p>
              </div>
            )}

            <div className="pt-4 border-t border-border md:hidden">
              <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider flex items-center gap-1 mb-2">
                <User size={12} /> Propriétaire
              </p>
              <Button
                variant="outline"
                className="w-full gap-2 border-border justify-start"
                onClick={() => router.push(`/customers/${vehicle.customerId}`)}
              >
                <User size={16} className="text-brand shrink-0" />
                <span className="truncate font-medium">{ownerName(vehicle.customer)}</span>
              </Button>
            </div>

            <div className="hidden md:block pt-4 border-t border-border">
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

        <div className="lg:col-span-2 space-y-4 sm:space-y-6">
          {/* Historique OT */}
          <Card className="border-border shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base sm:text-lg font-bold flex items-center gap-2">
                <History size={20} className="text-brand shrink-0" />
                Historique ({orders.length})
              </CardTitle>
              <CardDescription className="text-xs sm:text-sm">
                Réparations sur ce véhicule
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              <VehicleOtMobileList
                orders={orders}
                onSelect={(otId) => router.push(`/workshop/${otId}`)}
              />
              <div className="hidden md:block">
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
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-6">
            <Card className="border-border shadow-sm bg-brand/5">
              <CardContent className="p-4 flex gap-3 sm:gap-4">
                <div className="w-10 h-10 rounded-full bg-brand/10 text-brand flex items-center justify-center shrink-0">
                  <Calendar size={20} />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-bold text-foreground">Dernière visite</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {vehicle.lastServiceAt
                      ? new Date(vehicle.lastServiceAt).toLocaleDateString('fr-FR')
                      : 'Aucune visite enregistrée'}
                  </p>
                </div>
              </CardContent>
            </Card>
            <Card className="border-border shadow-sm bg-green-500/5">
              <CardContent className="p-4 flex gap-3 sm:gap-4">
                <div className="w-10 h-10 rounded-full bg-green-500/10 text-green-500 flex items-center justify-center shrink-0">
                  <ShieldCheck size={20} />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-bold text-foreground">VIN</p>
                  <p className="text-xs text-muted-foreground mt-1 truncate">
                    {vehicle.vin || 'Non renseigné'}
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Barre d'action mobile — même logique que TechMobileBar / constat */}
      {canCreateOT && (
        <div
          className="md:hidden fixed left-0 right-0 z-[90] border-t border-border bg-card/95 backdrop-blur-xl px-3 py-2 shadow-[0_-4px_16px_rgba(0,0,0,0.08)]"
          style={{ bottom: MOBILE_BOTTOM_NAV_OFFSET }}
        >
          <Button
            className={cn(
              'w-full max-w-lg mx-auto flex h-11 font-bold gap-2',
              pendingReception
                ? 'bg-amber-500 hover:bg-amber-600 text-white'
                : 'bg-brand hover:bg-brand-hover',
            )}
            onClick={goReception}
          >
            <Wrench size={18} />
            {receptionLabel}
          </Button>
        </div>
      )}

      {canEdit && (
        <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
          <DialogContent className="sm:max-w-lg bg-card border-border max-h-[92dvh] overflow-y-auto">
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
