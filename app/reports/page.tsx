'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  TrendingUp,
  TrendingDown,
  Users,
  Wrench,
  Clock,
  DollarSign,
  Download,
  Calendar as CalendarIcon,
  ChevronRight,
  ShieldCheck,
  Lock,
  Target,
} from "lucide-react";
import { motion } from "motion/react";
import { 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis
} from 'recharts';
import { reportsApi, billingApi, customersApi, workshopApi, type MonthlyTargetRow } from "@/lib/api";
import { formatXAF, cn } from "@/lib/utils";
import { useRouter } from "next/navigation";

const MONTH_SHORT = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc'] as const;

function targetAchievementBadge(status: MonthlyTargetRow['status'], pct: number | null) {
  const badge =
    status === 'exceeded' ? 'bg-green-100 text-green-700'
    : status === 'close' ? 'bg-orange-100 text-orange-700'
    : status === 'missed' ? 'bg-red-100 text-red-600'
    : 'bg-slate-100 text-slate-500';
  if (pct === null) return { badge, label: '—' as const };
  return { badge, label: `${pct} %` as const };
}

function MonthlyTargetsMobileList({
  targets,
  targetYear,
  loading,
}: {
  targets: MonthlyTargetRow[];
  targetYear: number;
  loading: boolean;
}) {
  if (loading) {
    return (
      <div className="md:hidden space-y-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-28 w-full rounded-xl" />
        ))}
      </div>
    );
  }

  if (targets.length === 0) {
    return (
      <p className="md:hidden text-sm text-muted-foreground text-center py-6">
        Aucun objectif pour cette année.
      </p>
    );
  }

  return (
    <div className="md:hidden space-y-2">
      {targets.map((row) => {
        const { badge, label } = targetAchievementBadge(row.status, row.achievementPct);
        return (
          <Card key={row.month} className="border-border shadow-sm ring-1 ring-border/50">
            <CardContent className="p-4">
              <div className="flex items-center justify-between gap-2 mb-3">
                <p className="text-sm font-bold text-foreground">
                  {MONTH_SHORT[row.month - 1]} {targetYear}
                </p>
                {row.achievementPct !== null ? (
                  <span className={cn('inline-flex rounded-full px-2.5 py-0.5 text-xs font-bold', badge)}>
                    {label}
                  </span>
                ) : (
                  <span className="text-xs text-muted-foreground">—</span>
                )}
              </div>
              <dl className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <dt className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Objectif</dt>
                  <dd className="mt-1 font-mono text-sm text-foreground">
                    {row.targetXaf ? formatXAF(row.targetXaf) : 'Non défini'}
                  </dd>
                </div>
                <div>
                  <dt className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Réalisé</dt>
                  <dd className="mt-1 font-mono text-sm text-foreground">
                    {row.revenue > 0 ? formatXAF(row.revenue) : '—'}
                  </dd>
                </div>
              </dl>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

export default function ReportsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [hasPermission, setHasPermission] = useState(true);

  // KPIs
  const [revenueMtd, setRevenueMtd] = useState(0);
  const [revenueChange, setRevenueChange] = useState('');
  const [revenueTrend, setRevenueTrend] = useState<'up' | 'down'>('up');

  const [avgInterventionTime, setAvgInterventionTime] = useState(0);
  const [avgInterventionChange, setAvgInterventionChange] = useState('');
  const [avgInterventionTrend, setAvgInterventionTrend] = useState<'up' | 'down'>('down');

  const [newCustomersCount, setNewCustomersCount] = useState(0);
  const [newCustomersChange, setNewCustomersChange] = useState('');
  const [newCustomersTrend, setNewCustomersTrend] = useState<'up' | 'down'>('up');

  const [returnRate, setReturnRate] = useState('0.0');

  // Chart Data
  const [revenueChartData, setRevenueChartData] = useState<any[]>([]);
  const [techPerformance, setTechPerformance] = useState<any[]>([]);

  // Objectifs mensuels
  const currentYear = new Date().getFullYear();
  const [targetYear, setTargetYear] = useState(currentYear);
  const [targets, setTargets]       = useState<MonthlyTargetRow[]>([]);
  const [targetsLoading, setTargetsLoading] = useState(false);

  useEffect(() => {
    async function loadReportData() {
      setLoading(true);
      try {
        const now = new Date();
        const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const prevMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);

        // 1. Fetch Revenue report data (requires ADMIN)
        let revenueCurrent;
        let revenuePrev;
        try {
          [revenueCurrent, revenuePrev] = await Promise.all([
            reportsApi.revenue({ startDate: currentMonthStart.toISOString() }) as Promise<any>,
            reportsApi.revenue({ startDate: prevMonthStart.toISOString(), endDate: prevMonthEnd.toISOString() }) as Promise<any>
          ]);
        } catch (err: any) {
          if (err?.status === 403) {
            setHasPermission(false);
            setLoading(false);
            return;
          }
          throw err;
        }

        const curRev = Number(revenueCurrent?.totalRevenue || 0);
        const preRev = Number(revenuePrev?.totalRevenue || 0);
        setRevenueMtd(curRev);

        if (curRev === 0 && preRev === 0) {
          setRevenueChange('—');
          setRevenueTrend('up');
        } else if (preRev > 0) {
          const diff = ((curRev - preRev) / preRev) * 100;
          setRevenueChange(diff >= 0 ? `+${diff.toFixed(1)}%` : `${diff.toFixed(1)}%`);
          setRevenueTrend(diff >= 0 ? 'up' : 'down');
        } else {
          setRevenueChange('Nouveau');
          setRevenueTrend('up');
        }

        // 2. Fetch Technician Performance (requires ADMIN)
        const perfData = await reportsApi.performance() as Record<string, { estimatedHours: number; actualHours: number }>;
        
        let totalEst = 0;
        let totalAct = 0;
        Object.values(perfData).forEach(p => {
          totalEst += Number(p.estimatedHours || 0);
          totalAct += Number(p.actualHours || 0);
        });
        
        const techCount = Object.keys(perfData).length;
        const avgTime = techCount > 0 ? (totalAct / techCount) : 0;
        setAvgInterventionTime(avgTime);
        if (techCount === 0 || avgTime === 0) {
          setAvgInterventionChange('—');
          setAvgInterventionTrend('down');
        } else {
          const timeDiff = ((avgTime - 4.0) / 4.0) * 100;
          setAvgInterventionChange(timeDiff <= 0 ? `${timeDiff.toFixed(1)}%` : `+${timeDiff.toFixed(1)}%`);
          setAvgInterventionTrend(timeDiff <= 0 ? 'down' : 'up');
        }

        // 3. Fetch New Customers count
        const customers = await customersApi.list() as any[];
        const curCust = customers.filter(c => new Date(c.createdAt) >= currentMonthStart).length;
        const preCust = customers.filter(c => {
          const d = new Date(c.createdAt);
          return d >= prevMonthStart && d < currentMonthStart;
        }).length;

        setNewCustomersCount(curCust);
        if (curCust === 0 && preCust === 0) {
          setNewCustomersChange('—');
          setNewCustomersTrend('up');
        } else if (preCust > 0) {
          const diff = ((curCust - preCust) / preCust) * 100;
          setNewCustomersChange(diff >= 0 ? `+${diff.toFixed(1)}%` : `${diff.toFixed(1)}%`);
          setNewCustomersTrend(diff >= 0 ? 'up' : 'down');
        } else {
          setNewCustomersChange('Nouveau');
          setNewCustomersTrend('up');
        }

        // 4. Calculate return rate proxy (cancelled OTs rate)
        const ots = await workshopApi.listOTs() as any[];
        const cancelledCount = ots.filter(o => o.status === 'CANCELLED').length;
        const calculatedRate = ots.length > 0 ? ((cancelledCount / ots.length) * 100).toFixed(1) : "0.0";
        setReturnRate(calculatedRate);

        // 5. Monthly Revenue Chart — 6 derniers mois avec vrais objectifs
        const invoices = await billingApi.listInvoices() as any[];
        const monthNames = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sept', 'Oct', 'Nov', 'Déc'];

        // Charger les objectifs de l'année courante pour le graphe
        let dbTargets: MonthlyTargetRow[] = [];
        try { dbTargets = await reportsApi.targets(new Date().getFullYear()); } catch { /* pas d'objectifs */ }

        const revChartData = [];
        for (let i = 5; i >= 0; i--) {
          const d = new Date();
          d.setMonth(d.getMonth() - i);
          const monthIndex = d.getMonth();
          const year = d.getFullYear();
          const label = monthNames[monthIndex];

          const monthlyRevenue = invoices
            .filter(inv => {
              if (inv.status !== 'PAID' || !inv.paidAt) return false;
              const paidDate = new Date(inv.paidAt);
              return paidDate.getMonth() === monthIndex && paidDate.getFullYear() === year;
            })
            .reduce((sum, inv) => sum + Number(inv.totalXaf || 0), 0);

          const dbTarget = dbTargets.find(t => t.month === monthIndex + 1 && year === new Date().getFullYear());
          const target = dbTarget?.targetXaf ?? (monthlyRevenue > 0 ? Math.round(monthlyRevenue * 1.15) : null);

          revChartData.push({ month: label, revenue: monthlyRevenue, target });
        }
        setRevenueChartData(revChartData);

        // 6. Map technician performance table depuis perfData déjà chargé
        const mappedTechs = Object.entries(perfData).map(([name, data]) => {
          const efficiency = data.actualHours > 0
            ? Math.round((data.estimatedHours / data.actualHours) * 100)
            : 100;
          return { name, jobs: Math.round(data.actualHours), efficiency };
        });
        setTechPerformance(mappedTechs);

      } catch (err) {
        console.error("Error loading reports data:", err);
      } finally {
        setLoading(false);
      }
    }
    loadReportData();
  }, []);

  // Chargement des objectifs (déclenché par l'année sélectionnée)
  useEffect(() => {
    setTargetsLoading(true);
    reportsApi.targets(targetYear)
      .then(data => setTargets(data))
      .catch(() => {})
      .finally(() => setTargetsLoading(false));
  }, [targetYear]);

  const formatKpiValue = (val: number): string => {
    if (val >= 1000000) {
      return (val / 1000000).toFixed(1) + "M";
    }
    if (val >= 1000) {
      return (val / 1000).toFixed(0) + "k";
    }
    return val.toString();
  };

  if (loading) {
    return (
      <div className="space-y-6 pb-20 md:pb-0 md:space-y-8">
        <div className="flex flex-col gap-3 sm:flex-row sm:justify-between">
          <Skeleton className="h-10 w-full max-w-xs" />
          <div className="flex gap-2">
            <Skeleton className="h-10 flex-1 sm:w-36" />
            <Skeleton className="h-10 flex-1 sm:w-40" />
          </div>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28 md:h-32 rounded-xl" />
          ))}
        </div>
        <div className="space-y-6 lg:grid lg:grid-cols-2 lg:gap-8 lg:space-y-0">
          <Skeleton className="h-64 md:h-96 rounded-xl" />
          <Skeleton className="h-64 md:h-96 rounded-xl" />
        </div>
      </div>
    );
  }

  if (!hasPermission) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center p-6">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-md w-full"
        >
          <Card className="bg-card/60 backdrop-blur-xl border-border/80 shadow-2xl text-center p-8 relative overflow-hidden">
            <div className="absolute -top-10 -right-10 w-40 h-40 bg-brand/10 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute -bottom-10 -left-10 w-40 h-40 bg-red-500/5 rounded-full blur-3xl pointer-events-none" />
            
            <div className="mx-auto w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mb-6 ring-1 ring-red-500/20">
              <Lock className="text-red-500" size={28} />
            </div>
            
            <CardTitle className="text-2xl font-bold text-foreground mb-3">Accès Restreint</CardTitle>
            <CardDescription className="text-sm text-muted-foreground mb-6 leading-relaxed">
              Ce module de rapports financiers et de performance nécessite des privilèges d'administrateur. Veuillez contacter votre chef d'atelier pour obtenir les accès requis.
            </CardDescription>
            
            <div className="flex flex-col gap-3">
              <Button 
                onClick={() => router.push('/dashboard')}
                className="w-full bg-brand hover:bg-brand-hover text-white shadow-lg shadow-brand/20 h-11"
              >
                Retour au Tableau de Bord
              </Button>
            </div>
          </Card>
        </motion.div>
      </div>
    );
  }

  const kpis = [
    {
      title: "Chiffre d'affaires (MTD)",
      value: formatKpiValue(revenueMtd),
      unit: "XAF",
      change: revenueChange,
      trend: revenueTrend,
      icon: DollarSign,
      color: "text-green-600",
      bg: "bg-green-500/10",
    },
    {
      title: "Temps moyen d'intervention",
      value: avgInterventionTime > 0 ? avgInterventionTime.toFixed(1) : "—",
      unit: "heures",
      change: avgInterventionChange,
      trend: avgInterventionTrend === 'down' ? 'up' : 'down', // down is good for time
      icon: Clock,
      color: "text-brand",
      bg: "bg-brand/10",
    },
    {
      title: "Nouveaux Clients",
      value: newCustomersCount.toString(),
      unit: "ce mois",
      change: newCustomersChange,
      trend: newCustomersTrend,
      icon: Users,
      color: "text-purple-600",
      bg: "bg-purple-500/10",
    },
    {
      title: "Taux d'annulation / retour",
      value: returnRate,
      unit: "%",
      change: "-0.5%",
      trend: "up",
      icon: ShieldCheck,
      color: "text-amber-600",
      bg: "bg-amber-500/10",
    },
  ];

  const periodLabel = new Date().toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });

  return (
    <div className="space-y-6 pb-20 md:pb-0 md:space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="min-w-0">
          <h1 className="text-xl font-bold text-foreground md:text-2xl">Rapports & Performance</h1>
          <p className="text-sm text-muted-foreground md:text-base">
            Analysez l&apos;activité et la rentabilité de votre atelier
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:gap-3">
          <Button variant="outline" className="gap-2 border-border h-10 w-full sm:w-auto justify-center">
            <CalendarIcon size={18} className="shrink-0" />
            <span className="truncate capitalize">{periodLabel}</span>
          </Button>
          <Button className="bg-brand hover:bg-brand-hover gap-2 text-white h-10 w-full sm:w-auto justify-center">
            <Download size={18} className="shrink-0" />
            <span className="sm:hidden">Exporter</span>
            <span className="hidden sm:inline">Exporter le rapport</span>
          </Button>
        </div>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-6">
        {kpis.map((kpi, index) => (
          <motion.div
            key={kpi.title}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
          >
            <Card className="border-border shadow-sm ring-1 ring-border/50 bg-card hover:shadow-md transition-all h-full">
              <CardContent className="p-4 md:p-6">
                <div className="flex items-center justify-between gap-1">
                  <div className={cn(kpi.bg, 'p-2 md:p-2.5 rounded-xl shrink-0')}>
                    <kpi.icon className={kpi.color} size={18} />
                  </div>
                  {kpi.change && (
                    <div className={cn(
                      'flex items-center gap-0.5 text-[10px] md:text-xs font-bold shrink-0',
                      kpi.trend === 'up' ? 'text-green-600' : 'text-red-600',
                    )}>
                      {kpi.trend === 'up' ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
                      <span className="max-w-[4.5rem] truncate md:max-w-none">{kpi.change}</span>
                    </div>
                  )}
                </div>
                <div className="mt-3 md:mt-4">
                  <p className="text-[10px] md:text-sm font-medium text-muted-foreground leading-tight line-clamp-2">
                    {kpi.title}
                  </p>
                  <div className="flex items-baseline gap-1 mt-1 flex-wrap">
                    <span className="text-lg md:text-2xl font-bold text-foreground">{kpi.value}</span>
                    <span className="text-[10px] md:text-xs font-mono text-muted-foreground">{kpi.unit}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      <div className="space-y-6 lg:grid lg:grid-cols-2 lg:gap-8 lg:space-y-0">
        {/* Revenue Chart */}
        <Card className="border-border shadow-sm ring-1 ring-border/50 bg-card overflow-visible">
          <CardHeader className="px-4 pb-2 md:px-6 md:pb-0">
            <CardTitle className="text-base font-bold md:text-lg">Évolution du Chiffre d&apos;Affaires</CardTitle>
            <CardDescription className="text-xs md:text-sm">Revenus mensuels vs objectifs (XAF)</CardDescription>
          </CardHeader>
          <CardContent className="h-[220px] sm:h-[280px] md:h-[350px] pt-2 pl-1 pr-3 pb-4 md:px-6 md:pt-4 md:pb-6 overflow-visible">
            {revenueChartData.length === 0 ? (
              <div className="h-full w-full flex items-center justify-center text-muted-foreground text-sm">
                Aucune donnée financière disponible
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%" className="[&_svg]:overflow-visible">
                <AreaChart data={revenueChartData} margin={{ top: 8, right: 8, left: 0, bottom: 4 }}>
                  <defs>
                    <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--brand)" stopOpacity={0.1}/>
                      <stop offset="95%" stopColor="var(--brand)" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                  <XAxis 
                    dataKey="month" 
                    axisLine={false} 
                    tickLine={false} 
                    interval={0}
                    tick={{ fontSize: 9, fill: '#94a3b8', fontWeight: 700 }}
                  />
                  <YAxis
                    width={52}
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 700 }}
                    tickFormatter={(value) =>
                      value >= 1_000_000 ? `${Math.round(value / 1_000_000)}M`
                      : value >= 1_000 ? `${Math.round(value / 1_000)}k`
                      : '0'
                    }
                  />
                  <Tooltip 
                    contentStyle={{ 
                      borderRadius: '12px', 
                      border: '1px solid var(--border)', 
                      boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)',
                      backgroundColor: 'rgba(255, 255, 255, 0.95)',
                      color: 'var(--foreground)'
                    }}
                    itemStyle={{ color: 'var(--foreground)' }}
                    formatter={(value: any, name: any) => [
                      `${Number(value).toLocaleString()} XAF`,
                      name === 'revenue' ? 'Revenu' : 'Objectif',
                    ] as any}
                  />
                  <Area
                    type="monotone"
                    dataKey="revenue"
                    name="revenue"
                    stroke="var(--brand)"
                    strokeWidth={3}
                    fillOpacity={1}
                    fill="url(#colorRev)"
                  />
                  <Area
                    type="monotone"
                    dataKey="target"
                    name="target"
                    stroke="#cbd5e1"
                    strokeWidth={2}
                    strokeDasharray="5 5"
                    fill="transparent"
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Objectifs mensuels — lecture seule, édition dans Paramètres */}
        <Card className="border-border shadow-sm ring-1 ring-border/50 bg-card">
          <CardHeader className="px-4 md:px-6 space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <CardTitle className="text-base font-bold md:text-lg flex items-center gap-2">
                  <Target size={18} className="text-brand shrink-0" /> Atteinte des objectifs
                </CardTitle>
                <CardDescription className="text-xs md:text-sm mt-1">
                  <span className="hidden sm:inline">Vert ≥ 100 % · Orange 80–99 % · Rouge &lt; 80 % · </span>
                  <a href="/settings" className="text-brand hover:underline font-medium">Modifier →</a>
                </CardDescription>
              </div>
              <div className="flex items-center gap-1 shrink-0 rounded-lg border border-border bg-muted/30 p-0.5">
                <button
                  type="button"
                  onClick={() => setTargetYear((y) => y - 1)}
                  className="h-9 w-9 rounded-md text-muted-foreground hover:bg-background text-lg leading-none"
                  aria-label="Année précédente"
                >
                  ‹
                </button>
                <span className="font-bold text-foreground min-w-[2.75rem] text-center text-sm">{targetYear}</span>
                <button
                  type="button"
                  onClick={() => setTargetYear((y) => y + 1)}
                  disabled={targetYear >= currentYear}
                  className="h-9 w-9 rounded-md text-muted-foreground hover:bg-background text-lg leading-none disabled:opacity-30"
                  aria-label="Année suivante"
                >
                  ›
                </button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="px-4 pb-4 md:px-6 md:pb-6">
            <MonthlyTargetsMobileList
              targets={targets}
              targetYear={targetYear}
              loading={targetsLoading}
            />
            {targetsLoading ? (
              <div className="hidden md:block space-y-2">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="h-10 bg-muted animate-pulse rounded" />
                ))}
              </div>
            ) : (
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-2 pr-4 font-semibold text-muted-foreground text-xs uppercase tracking-wide">Mois</th>
                      <th className="text-right py-2 px-3 font-semibold text-muted-foreground text-xs uppercase tracking-wide">Objectif</th>
                      <th className="text-right py-2 px-3 font-semibold text-muted-foreground text-xs uppercase tracking-wide">Réalisé</th>
                      <th className="text-right py-2 pl-3 font-semibold text-muted-foreground text-xs uppercase tracking-wide">Atteinte</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {targets.map((row) => {
                      const { badge, label } = targetAchievementBadge(row.status, row.achievementPct);
                      return (
                        <tr key={row.month} className="hover:bg-muted/40 transition-colors">
                          <td className="py-2.5 pr-4 font-medium text-foreground">
                            {MONTH_SHORT[row.month - 1]} {targetYear}
                          </td>
                          <td className="py-2.5 px-3 text-right text-muted-foreground">
                            {row.targetXaf ? formatXAF(row.targetXaf) : <span className="text-muted-foreground/50 text-xs">Non défini</span>}
                          </td>
                          <td className="py-2.5 px-3 text-right text-muted-foreground">
                            {row.revenue > 0 ? formatXAF(row.revenue) : <span className="text-muted-foreground/50">—</span>}
                          </td>
                          <td className="py-2.5 pl-3 text-right">
                            {row.achievementPct !== null ? (
                              <span className={cn('inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold', badge)}>
                                {label}
                              </span>
                            ) : (
                              <span className="text-muted-foreground/50 text-xs">—</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Technician Performance */}
        <Card className="border-border shadow-sm ring-1 ring-border/50 bg-card lg:col-span-2">
          <CardHeader className="px-4 md:px-6">
            <CardTitle className="text-base font-bold md:text-lg">Performance par Technicien</CardTitle>
            <CardDescription className="text-xs md:text-sm">Productivité et qualité du travail</CardDescription>
          </CardHeader>
          <CardContent className="px-4 pb-4 md:px-6 md:pb-6">
            <div className="space-y-5 md:space-y-6">
              {techPerformance.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-6">Aucune donnée technicien pour cette période.</p>
              )}
              {techPerformance.map((tech) => (
                <div key={tech.name} className="space-y-2.5 md:space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-8 h-8 rounded-full bg-brand/10 text-brand flex items-center justify-center font-bold text-xs shrink-0">
                        {tech.name.split(' ').map((n: string) => n[0]).join('')}
                      </div>
                      <span className="text-sm font-bold text-foreground truncate">{tech.name}</span>
                    </div>
                    <span className="text-[10px] md:text-xs font-mono text-muted-foreground shrink-0 whitespace-nowrap">
                      {tech.jobs} OT
                    </span>
                  </div>
                  <div className="space-y-1">
                    <div className="flex justify-between text-[10px] uppercase font-bold tracking-wider text-muted-foreground">
                      <span>Efficacité</span>
                      <span>{tech.efficiency}%</span>
                    </div>
                    <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-brand rounded-full" 
                        style={{ width: `${Math.min(tech.efficiency, 100)}%` }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <Button variant="ghost" className="w-full mt-6 text-brand hover:bg-brand/10 font-bold text-xs" onClick={() => router.push('/team')}>
              Détails de l&apos;équipe <ChevronRight size={16} className="ml-1" />
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
