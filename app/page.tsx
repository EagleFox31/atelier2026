'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Wrench, Car, Clock, CheckCircle2, TrendingUp, Plus, AlertCircle, ArrowDown, ClipboardList } from "lucide-react";
import { motion } from "motion/react";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { OrderForm } from "@/components/forms/OrderForm";
import { useRouter } from "next/navigation";
import dynamic from 'next/dynamic';
const RevenueChart           = dynamic(() => import('@/components/dashboard/AdvancedCharts').then(m => ({ default: m.RevenueChart })),           { ssr: false, loading: () => <div className="h-48 animate-pulse bg-muted rounded-xl" /> });
const StatusDistributionChart = dynamic(() => import('@/components/dashboard/AdvancedCharts').then(m => ({ default: m.StatusDistributionChart })), { ssr: false, loading: () => <div className="h-48 animate-pulse bg-muted rounded-xl" /> });
const TechEfficiencyChart    = dynamic(() => import('@/components/dashboard/AdvancedCharts').then(m => ({ default: m.TechEfficiencyChart })),    { ssr: false, loading: () => <div className="h-48 animate-pulse bg-muted rounded-xl" /> });
import { useAuth } from "@/contexts/auth-context";
import { TechnicianHomeRedirect } from "@/components/layout/TechnicianHomeRedirect";
import { isTechnicianProfile } from "@/lib/role-routing";
import { workshopApi, planningApi, teamApi } from "@/lib/api";
import { WORKSHOP_STATUS, isActiveOT } from "@/lib/constants";

const STAT_META = [
  { icon: Wrench,        color: 'text-brand',       bg: 'bg-brand/10' },
  { icon: Car,           color: 'text-red-500',     bg: 'bg-red-500/10' },
  { icon: CheckCircle2,  color: 'text-green-500',   bg: 'bg-green-500/10' },
  { icon: TrendingUp,    color: 'text-amber-500',   bg: 'bg-amber-500/10' },
];

export default function DashboardPage() {
  const router = useRouter();
  const { user, hasPermission, hasRole } = useAuth();
  const canCreateOT    = hasPermission('ORD_CREATE');
  const canSeeFinance  = hasRole('ADMIN') || hasRole('CHEF_ATELIER') || hasRole('SUPER_ADMIN');
  const isReceptionnaire = hasRole('RECEPTIONNISTE') || hasRole('ADMIN') || hasRole('CHEF_ATELIER');
  const isTechnician = isTechnicianProfile(user);
  const [isOrderModalOpen, setIsOrderModalOpen] = useState(false);
  const [stats, setStats]         = useState<any[]>([]);
  const [statsLoading, setStatsLoading] = useState(true);
  const [priorityOTs, setPriorityOTs]     = useState<any[]>([]);
  const [waitingOTs, setWaitingOTs]       = useState<any[]>([]);
  const [receptionOTs, setReceptionOTs]   = useState<any[]>([]);
  const [otsLoading, setOtsLoading]     = useState(true);
  const [appointments, setApts]         = useState<any[]>([]);
  const [aptsLoading, setAptsLoading]   = useState(true);
  const [team, setTeam]                 = useState<any[]>([]);
  const [teamLoading, setTeamLoading]   = useState(true);

  useEffect(() => {
    fetch('/api/dashboard/stats')
      .then(r => r.json()).then(d => setStats(d.stats ?? []))
      .catch(() => {}).finally(() => setStatsLoading(false));

    (workshopApi.listOTs() as Promise<any[]>).then(data => {
      setPriorityOTs(
        data
          .filter(o => ['URGENT', 'HIGH'].includes(o.priority) && isActiveOT(o.status))
          .slice(0, 3),
      );
      setWaitingOTs(data.filter(o => o.status === 'RECEIVED').slice(0, 3));
      setReceptionOTs(data.filter(o => o.status === 'DRAFT').slice(0, 5));
    }).catch(() => {}).finally(() => setOtsLoading(false));

    const today = new Date().toISOString().split('T')[0];
    (planningApi.list({ date: today }) as Promise<any[]>)
      .then(d => setApts(d.slice(0, 5))).catch(() => {}).finally(() => setAptsLoading(false));

    (teamApi.list() as Promise<any[]>)
      .then(d => setTeam(d.slice(0, 4))).catch(() => {}).finally(() => setTeamLoading(false));
  }, []);

  const displayStats = stats.length > 0 ? stats : [
    { title: 'OT en cours', value: '—', trend: '' },
    { title: "Reçus aujourd'hui", value: '—', trend: '' },
    { title: 'Terminés', value: '—', trend: '' },
    { title: "Chiffre d'affaires", value: '—', trend: '' },
  ];

  return (
    <div className="space-y-8">
      <TechnicianHomeRedirect />
      {isTechnician ? (
        <div className="flex flex-col items-center justify-center py-24 gap-3 text-muted-foreground">
          <Wrench size={32} className="text-brand animate-pulse" />
          <p className="text-sm">Redirection vers vos ordres de travail…</p>
        </div>
      ) : (
        <>
      {/* Welcome */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground tracking-tight">
            Bonjour, {user?.firstName ?? 'Chef'} 👋
          </h1>
          <p className="text-muted-foreground mt-1">
            {new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" className="gap-2 border-border h-10 px-4" onClick={() => router.push('/planning')}>
            <Clock size={18} /> Planning
          </Button>
          {canCreateOT && (
            <Dialog open={isOrderModalOpen} onOpenChange={setIsOrderModalOpen}>
              <DialogTrigger render={
                <Button className="gap-2 bg-brand hover:bg-brand-hover text-white h-10 px-4 shadow-lg shadow-brand/20">
                  <Plus size={18} /> Nouvel OT
                </Button>
              } />
              <DialogContent className="sm:max-w-[600px] bg-card border-border">
                <DialogHeader><DialogTitle>Ouvrir un nouvel Ordre de Travail</DialogTitle></DialogHeader>
                <OrderForm onSuccess={() => setIsOrderModalOpen(false)} />
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>

      {/* Stats grid — mobile : 2 KPI par ligne */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-6">
        {statsLoading
          ? Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)
          : displayStats.map((stat, i) => {
            const meta = STAT_META[i] ?? STAT_META[0];
            const Icon = meta.icon;
            return (
              <motion.div key={stat.title} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}>
                <Card className="bg-card border-border shadow-sm hover:shadow-md transition-all ring-1 ring-border/50 h-full">
                  <CardContent className="p-4 md:p-6">
                    <div className="flex items-center justify-between">
                      <div className={cn(meta.bg, "p-2 md:p-3 rounded-xl ring-1 ring-brand/10")}><Icon className={meta.color} size={18} /></div>
                      {stat.trend && stat.trend !== '-' && (
                        <Badge variant="secondary" className="bg-green-500/10 text-green-600 border-none text-[9px] md:text-[10px] font-bold">{stat.trend}</Badge>
                      )}
                    </div>
                    <div className="mt-3 md:mt-5">
                      <p className="text-muted-foreground text-[10px] md:text-xs font-medium leading-tight">{stat.title}</p>
                      <p className="text-xl md:text-3xl font-bold text-foreground mt-1">{stat.value}</p>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })
        }
      </div>

      {/* Réceptions en attente — visible réceptionnaire / chef / admin */}
      {isReceptionnaire && receptionOTs.length > 0 && (
        <Card className="bg-card border-border border-amber-500/20 ring-1 ring-amber-500/10 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center">
                <ClipboardList size={16} className="text-amber-500" />
              </div>
              <div>
                <CardTitle className="text-base font-bold">Réceptions à finaliser</CardTitle>
                <CardDescription className="text-xs">OT créés sans contrôle de réception</CardDescription>
              </div>
            </div>
            <Badge className="bg-amber-500/10 text-amber-700 border-amber-200 dark:border-amber-800 dark:text-amber-400 font-bold">
              {receptionOTs.length}
            </Badge>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {receptionOTs.map(o => (
                <div key={o.id}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-muted hover:bg-muted/80 cursor-pointer transition-colors border border-transparent hover:border-amber-500/20"
                  onClick={() => router.push(`/workshop/${o.id}`)}
                >
                  <Car size={14} className="text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-foreground font-mono leading-tight">{o.vehicle?.plateNumber}</p>
                    <p className="text-[11px] text-muted-foreground truncate">{[o.vehicle?.make?.name, o.vehicle?.model?.name].filter(Boolean).join(' ')}</p>
                  </div>
                  <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                    {new Date(o.openedAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
          <div className="p-4 border-t border-border">
            <Button variant="ghost" className="w-full text-amber-600 hover:bg-amber-500/10 font-bold text-xs"
              onClick={() => router.push('/workshop?tab=reception')}>
              Voir toutes les réceptions
            </Button>
          </div>
        </Card>
      )}

      {/* Middle row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Rendez-vous */}
        <Card className="bg-card border-border flex flex-col ring-1 ring-border/50 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-4">
            <div>
              <CardTitle className="text-lg font-bold">Rendez-vous du jour</CardTitle>
              <CardDescription className="text-xs">{new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}</CardDescription>
            </div>
            <Badge className="bg-brand/10 text-brand border-none h-6 w-6 flex items-center justify-center p-0 rounded-full text-[10px] font-bold">
              {aptsLoading ? '…' : appointments.length}
            </Badge>
          </CardHeader>
          <CardContent className="flex-1 space-y-3">
            {aptsLoading
              ? Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-xl" />)
              : appointments.length === 0
              ? <p className="text-sm text-muted-foreground text-center py-6">Aucun RDV aujourd&apos;hui</p>
              : appointments.map(apt => (
                <div key={apt.id} className="flex items-center gap-4 p-3 rounded-xl hover:bg-muted transition-colors">
                  <div className="flex flex-col items-center justify-center w-14 h-14 rounded-xl bg-muted font-bold border border-border shrink-0">
                    <span className="text-[8px] uppercase text-muted-foreground">Heure</span>
                    <span className="text-sm font-mono">{new Date(apt.scheduledAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-foreground truncate">
                      {apt.customer ? [apt.customer.firstName, apt.customer.lastName].filter(Boolean).join(' ') : '—'}
                    </p>
                    <p className="text-[11px] text-muted-foreground truncate">{apt.reason}</p>
                  </div>
                </div>
              ))
            }
          </CardContent>
          <div className="p-4 border-t border-border">
            <Button variant="ghost" className="w-full text-brand hover:bg-brand/10 font-bold text-xs" onClick={() => router.push('/planning')}>
              Voir tout le planning
            </Button>
          </div>
        </Card>

        {/* En attente */}
        <Card className="bg-card border-border flex flex-col ring-1 ring-border/50 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-4">
            <div>
              <CardTitle className="text-lg font-bold">Véhicules en attente</CardTitle>
              <CardDescription className="text-xs">Prêts pour diagnostic</CardDescription>
            </div>
            <Badge className="bg-amber-500/10 text-amber-600 border-none h-6 w-6 flex items-center justify-center p-0 rounded-full text-[10px] font-bold">
              {otsLoading ? '…' : waitingOTs.length}
            </Badge>
          </CardHeader>
          <CardContent className="flex-1">
            {otsLoading
              ? <Skeleton className="h-24 rounded-xl" />
              : waitingOTs.length === 0
              ? <p className="text-sm text-muted-foreground text-center py-8">Aucun véhicule en attente</p>
              : waitingOTs.map(o => (
                <div key={o.id} className="flex items-center justify-between p-4 rounded-2xl bg-muted border border-border mb-3 cursor-pointer hover:border-brand/30 transition-colors" onClick={() => router.push(`/workshop/${o.id}`)}>
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-card flex items-center justify-center text-muted-foreground shadow-sm"><Car size={24} /></div>
                    <div>
                      <p className="text-sm font-bold text-foreground font-mono">{o.vehicle?.plateNumber}</p>
                      <p className="text-[11px] text-muted-foreground">{[o.vehicle?.make?.name, o.vehicle?.model?.name].filter(Boolean).join(' ')}</p>
                    </div>
                  </div>
                  <ArrowDown size={16} className="text-muted-foreground" />
                </div>
              ))
            }
          </CardContent>
          <div className="p-4 border-t border-border">
            <Button variant="ghost" className="w-full text-brand hover:bg-brand/10 font-bold text-xs" onClick={() => router.push('/workshop')}>
              Gérer la file d&apos;attente
            </Button>
          </div>
        </Card>

        {/* Prioritaires */}
        <Card className="bg-card border-border ring-1 ring-border/50 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-4">
            <div>
              <CardTitle className="text-lg font-bold">Tâches prioritaires</CardTitle>
              <CardDescription className="text-xs">Actions urgentes requises</CardDescription>
            </div>
            <div className="w-6 h-6 rounded-full bg-red-500/10 flex items-center justify-center">
              <AlertCircle className="text-red-500" size={16} />
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {otsLoading
              ? Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-2xl" />)
              : priorityOTs.length === 0
              ? <p className="text-sm text-muted-foreground text-center py-8">Aucune tâche urgente</p>
              : priorityOTs.map(o => {
                const st = WORKSHOP_STATUS[o.status];
                return (
                  <div key={o.id} className="p-4 rounded-2xl border border-red-500/10 bg-red-500/5 space-y-3 hover:bg-red-500/10 cursor-pointer transition-colors" onClick={() => router.push(`/workshop/${o.id}`)}>
                    <div className="flex items-center justify-between">
                      <Badge className="bg-red-500/20 text-red-600 border-none text-[9px] font-bold">{o.priority}</Badge>
                      <span className="text-[9px] font-mono text-muted-foreground">{o.reference}</span>
                    </div>
                    <div>
                      <p className="text-sm font-bold text-foreground">{[o.vehicle?.make?.name, o.vehicle?.model?.name].filter(Boolean).join(' ')}</p>
                      <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2">{o.clientComplaint}</p>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-muted-foreground">
                        {o.chef ? `${o.chef.firstName} ${o.chef.lastName}` : 'Non assigné'}
                      </span>
                      {st && <Badge className={cn("text-[9px] border-none", st.color)}>{st.label}</Badge>}
                    </div>
                  </div>
                );
              })
            }
          </CardContent>
        </Card>
      </div>

      {/* Charts — visibles ADMIN / CHEF_ATELIER uniquement */}
      {canSeeFinance && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <Card className="bg-card border-border lg:col-span-2 ring-1 ring-border/50 shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg font-bold">Performance Financière</CardTitle>
              <CardDescription className="text-xs">Revenus des 7 derniers jours (XAF)</CardDescription>
            </CardHeader>
            <CardContent><RevenueChart /></CardContent>
          </Card>
          <Card className="bg-card border-border ring-1 ring-border/50 shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg font-bold">Répartition des OT</CardTitle>
              <CardDescription className="text-xs">Par statut actuel</CardDescription>
            </CardHeader>
            <CardContent><StatusDistributionChart /></CardContent>
          </Card>
        </div>
      )}

      {/* Équipe */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
        {canSeeFinance && (
          <Card className="bg-card border-border lg:col-span-3 ring-1 ring-border/50 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <div>
                <CardTitle className="text-lg font-bold">Efficacité Techniciens</CardTitle>
                <CardDescription className="text-xs">Taux de rendement par membre</CardDescription>
              </div>
              <Button variant="outline" size="sm" className="text-[10px] font-bold border-border" onClick={() => router.push('/team')}>
                Détails →
              </Button>
            </CardHeader>
            <CardContent><TechEfficiencyChart /></CardContent>
          </Card>
        )}
        <Card className={cn("bg-card border-border ring-1 ring-border/50 shadow-sm", canSeeFinance ? "lg:col-span-2" : "lg:col-span-5")}>
          <CardHeader>
            <CardTitle className="text-lg font-bold">Équipe en direct</CardTitle>
            <CardDescription className="text-xs">Disponibilité actuelle</CardDescription>
          </CardHeader>
          <CardContent>
            {teamLoading
              ? <div className="space-y-4">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-10" />)}</div>
              : <div className="space-y-5">
                  {team.map((m, idx) => {
                    const colors = ['bg-blue-500','bg-green-500','bg-amber-500','bg-purple-500'];
                    return (
                      <div key={m.id} className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className={cn("w-10 h-10 rounded-full flex items-center justify-center font-bold text-[10px] text-white", colors[idx % colors.length])}>
                            {m.firstName?.[0]}{m.lastName?.[0]}
                          </div>
                          <div>
                            <p className="text-sm font-bold text-foreground">{m.firstName} {m.lastName}</p>
                            <p className="text-[10px] text-muted-foreground">{m.roles?.[0]?.role?.label ?? '—'}</p>
                          </div>
                        </div>
                        <Badge className={cn("text-[9px] border-none", m.status === 'ACTIVE' ? "bg-green-500/10 text-green-600" : "bg-muted text-muted-foreground")}>
                          {m.status === 'ACTIVE' ? 'Actif' : 'Suspendu'}
                        </Badge>
                      </div>
                    );
                  })}
                </div>
            }
          </CardContent>
        </Card>
      </div>
        </>
      )}
    </div>
  );
}

