'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Clock, Car, MoreHorizontal, CalendarDays, Wrench, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AppointmentForm } from "@/components/forms/AppointmentForm";
import { planningApi, workshopApi, handleApiError } from "@/lib/api";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const APT_STATUS: Record<string, { label: string; color: string }> = {
  SCHEDULED:  { label: 'Planifié',  color: 'bg-brand-light text-brand-hover' },
  CONFIRMED:  { label: 'Confirmé', color: 'bg-green-50 text-green-700' },
  CANCELLED:  { label: 'Annulé',   color: 'bg-red-50 text-red-600' },
  NO_SHOW:    { label: 'Absent',   color: 'bg-slate-100 text-slate-500' },
  COMPLETED:  { label: 'Effectué', color: 'bg-teal-50 text-teal-700' },
};

function vehicleName(v: any) {
  return [v?.make?.name, v?.model?.name].filter(Boolean).join(' ') || '—';
}
function customerName(c: any) {
  if (!c) return '—';
  return c.customerType === 'COMPANY'
    ? c.companyName
    : [c.firstName, c.lastName].filter(Boolean).join(' ');
}
function fmtTime(dt: string) {
  return new Date(dt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

export default function PlanningPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [date, setDate]             = useState<Date | undefined>(new Date());
  const [appointments, setApts]     = useState<any[]>([]);
  const [loading, setLoading]       = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [creatingOT, setCreatingOT] = useState<string | null>(null); // id de l'apt en cours

  useEffect(() => {
    if (searchParams.get('new') === '1') {
      setIsModalOpen(true);
    }
  }, [searchParams]);

  const load = useCallback(async (d?: Date) => {
    const target = d ?? date;
    if (!target) return;
    setLoading(true);
    try {
      const dateStr = target.toISOString().split('T')[0];
      const data = await planningApi.list({ date: dateStr }) as any[];
      setApts(data);
    } catch (err: unknown) {
      handleApiError(err, 'Impossible de charger le planning');
    } finally {
      setLoading(false);
    }
  }, [date]);

  useEffect(() => { load(); }, [load]);

  function handleDateSelect(d?: Date) {
    setDate(d);
    if (d) load(d);
  }

  async function createOTFromAppointment(apt: any) {
    if (!apt.vehicleId) {
      toast.error('Ce RDV n\'a pas de véhicule associé — créez l\'OT manuellement');
      return;
    }
    setCreatingOT(apt.id);
    try {
      const ot: any = await workshopApi.createOT({
        vehicleId:       apt.vehicleId,
        customerId:      apt.customerId,
        clientComplaint: apt.reason,
        priority:        'NORMAL',
      });
      // Marquer le RDV comme effectué
      await planningApi.update(apt.id, { status: 'COMPLETED' });
      toast.success(`OT ${ot.reference} créé`);
      router.push(`/workshop/${ot.id}`);
    } catch (err: unknown) {
      handleApiError(err, 'Impossible de créer l\'OT');
    } finally {
      setCreatingOT(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Planning de l&apos;Atelier</h1>
          <p className="text-muted-foreground">Gérez les rendez-vous et l&apos;occupation des baies</p>
        </div>
        <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
          <DialogTrigger render={
            <Button className="bg-brand hover:bg-brand-hover gap-2">
              <Plus size={18} /> Nouveau RDV
            </Button>
          } />
          <DialogContent className="sm:max-w-[500px] bg-card border-border">
            <DialogHeader>
              <DialogTitle>Prendre un rendez-vous</DialogTitle>
            </DialogHeader>
            <AppointmentForm
              initialDate={date?.toISOString().split('T')[0] ?? new Date().toISOString().split('T')[0]}
              onSuccess={() => { setIsModalOpen(false); load(); }}
            />
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Calendrier */}
        <Card className="lg:col-span-4 border-border shadow-sm h-fit">
          <CardContent className="p-4">
            <Calendar
              mode="single"
              selected={date}
              onSelect={handleDateSelect}
              className="rounded-md border-none w-full"
            />
            <div className="mt-6 space-y-3 px-2">
              <p className="text-xs font-bold text-foreground uppercase tracking-wider">Légende</p>
              {Object.entries(APT_STATUS).map(([k, v]) => (
                <div key={k} className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Badge className={cn("text-[9px] px-1.5 py-0 border-none", v.color)}>{v.label}</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Liste du jour */}
        <Card className="lg:col-span-8 border-border shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between border-b border-border">
            <div>
              <CardTitle className="text-lg font-bold">
                {date?.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
              </CardTitle>
              <CardDescription>
                {loading ? '...' : `${appointments.length} rendez-vous`}
              </CardDescription>
            </div>
            <Button variant="ghost" size="icon" className="text-muted-foreground">
              <MoreHorizontal size={18} />
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            {loading
              ? <div className="divide-y divide-border">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="p-4 flex gap-4">
                      <Skeleton className="w-16 h-14 rounded-xl shrink-0" />
                      <div className="flex-1 space-y-2">
                        <Skeleton className="h-4 w-40" />
                        <Skeleton className="h-3 w-28" />
                      </div>
                    </div>
                  ))}
                </div>
              : appointments.length === 0
              ? <div className="flex flex-col items-center gap-3 py-20 text-muted-foreground">
                  <CalendarDays size={40} strokeWidth={1} />
                  <p className="text-sm">Aucun rendez-vous ce jour</p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2 border-border"
                    onClick={() => setIsModalOpen(true)}
                  >
                    <Plus size={14} /> Ajouter un RDV
                  </Button>
                </div>
              : <div className="divide-y divide-border">
                  {appointments
                    .sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime())
                    .map(apt => {
                      const st = APT_STATUS[apt.status] ?? { label: apt.status, color: '' };
                      return (
                        <div key={apt.id} className="p-4 hover:bg-muted/30 transition-colors flex gap-4">
                          <div className="flex flex-col items-center justify-center w-16 h-14 rounded-xl bg-muted text-foreground font-bold border border-border shrink-0">
                            <span className="text-[8px] uppercase font-bold text-muted-foreground">Heure</span>
                            <span className="text-sm font-mono">{fmtTime(apt.scheduledAt)}</span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2">
                              <p className="font-bold text-foreground truncate">{customerName(apt.customer)}</p>
                              <Badge className={cn("text-[9px] border-none shrink-0", st.color)}>{st.label}</Badge>
                            </div>
                            <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground">
                              {apt.vehicle && (
                                <span className="flex items-center gap-1">
                                  <Car size={12} /> {vehicleName(apt.vehicle)}
                                </span>
                              )}
                              <span className="flex items-center gap-1">
                                <Clock size={12} /> {apt.durationMinutes} min
                              </span>
                            </div>
                            {apt.reason && (
                              <p className="text-xs text-muted-foreground mt-1 truncate">{apt.reason}</p>
                            )}
                          </div>
                          {/* Bouton créer OT */}
                          {['SCHEDULED', 'CONFIRMED'].includes(apt.status) && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="shrink-0 gap-1.5 text-[11px] border-brand/30 text-brand hover:bg-brand hover:text-white font-bold"
                              onClick={() => createOTFromAppointment(apt)}
                              disabled={creatingOT === apt.id}
                            >
                              {creatingOT === apt.id
                                ? <Loader2 size={12} className="animate-spin" />
                                : <Wrench size={12} />
                              }
                              Créer OT
                            </Button>
                          )}
                        </div>
                      );
                    })
                  }
                </div>
            }
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
