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
  Pencil,
  Trash2,
  Check,
  X,
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
import { formatXAF } from "@/lib/utils";
import { useRouter } from "next/navigation";

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
  const [editingMonth, setEditingMonth]     = useState<number | null>(null);
  const [editValue, setEditValue]           = useState('');

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

        if (preRev > 0) {
          const diff = ((curRev - preRev) / preRev) * 100;
          setRevenueChange(diff >= 0 ? `+${diff.toFixed(1)}%` : `${diff.toFixed(1)}%`);
          setRevenueTrend(diff >= 0 ? 'up' : 'down');
        } else {
          setRevenueChange('+100%');
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
        // Compare to target standard (e.g. 4.0 hours)
        const timeDiff = ((avgTime - 4.0) / 4.0) * 100;
        setAvgInterventionChange(timeDiff <= 0 ? `${timeDiff.toFixed(1)}%` : `+${timeDiff.toFixed(1)}%`);
        setAvgInterventionTrend(timeDiff <= 0 ? 'down' : 'up');

        // 3. Fetch New Customers count
        const customers = await customersApi.list() as any[];
        const curCust = customers.filter(c => new Date(c.createdAt) >= currentMonthStart).length;
        const preCust = customers.filter(c => {
          const d = new Date(c.createdAt);
          return d >= prevMonthStart && d < currentMonthStart;
        }).length;

        setNewCustomersCount(curCust);
        if (preCust > 0) {
          const diff = ((curCust - preCust) / preCust) * 100;
          setNewCustomersChange(diff >= 0 ? `+${diff.toFixed(1)}%` : `${diff.toFixed(1)}%`);
          setNewCustomersTrend(diff >= 0 ? 'up' : 'down');
        } else {
          setNewCustomersChange('+100%');
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

  async function saveTarget(month: number) {
    const val = parseFloat(editValue.replace(/\s/g, '').replace(',', '.'));
    if (!val || val <= 0) { setEditingMonth(null); return; }
    await reportsApi.upsertTarget({ year: targetYear, month, targetXaf: val });
    setEditingMonth(null);
    const data = await reportsApi.targets(targetYear);
    setTargets(data);
  }

  async function removeTarget(id: string) {
    await reportsApi.deleteTarget(id);
    const data = await reportsApi.targets(targetYear);
    setTargets(data);
  }

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
      <div className="space-y-8 p-4">
        <div className="flex justify-between items-center">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-32 rounded-xl" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <Skeleton className="h-96 rounded-xl" />
          <Skeleton className="h-96 rounded-xl" />
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
      color: "text-blue-600",
      bg: "bg-blue-500/10",
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

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Rapports & Performance</h1>
          <p className="text-muted-foreground">Analysez l&apos;activité et la rentabilité de votre atelier</p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" className="gap-2 border-border">
            <CalendarIcon size={18} />
            {new Date().toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}
          </Button>
          <Button className="bg-brand hover:bg-brand-hover gap-2 text-white">
            <Download size={18} />
            Exporter le rapport
          </Button>
        </div>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {kpis.map((kpi, index) => (
          <motion.div
            key={kpi.title}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
          >
            <Card className="border-border shadow-sm ring-1 ring-border/50 bg-card hover:shadow-md transition-all">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div className={`${kpi.bg} p-2.5 rounded-xl`}>
                    <kpi.icon className={kpi.color} size={20} />
                  </div>
                  {kpi.change && (
                    <div className={`flex items-center gap-1 text-xs font-bold ${kpi.trend === 'up' ? 'text-green-600' : 'text-red-600'}`}>
                      {kpi.trend === 'up' ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                      {kpi.change}
                    </div>
                  )}
                </div>
                <div className="mt-4">
                  <p className="text-sm font-medium text-muted-foreground">{kpi.title}</p>
                  <div className="flex items-baseline gap-1.5 mt-1">
                    <span className="text-2xl font-bold text-foreground">{kpi.value}</span>
                    <span className="text-xs font-mono text-muted-foreground">{kpi.unit}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Revenue Chart */}
        <Card className="border-border shadow-sm ring-1 ring-border/50 bg-card">
          <CardHeader>
            <CardTitle className="text-lg font-bold">Évolution du Chiffre d&apos;Affaires</CardTitle>
            <CardDescription>Revenus mensuels vs Objectifs (en XAF)</CardDescription>
          </CardHeader>
          <CardContent className="h-[350px] pt-4">
            {revenueChartData.length === 0 ? (
              <div className="h-full w-full flex items-center justify-center text-muted-foreground text-sm">
                Aucune donnée financière disponible
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={revenueChartData}>
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
                    tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 700 }}
                  />
                  <YAxis 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 700 }}
                    tickFormatter={(value) => value >= 1000000 ? `${value / 1000000}M` : value.toLocaleString()}
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

        {/* Objectifs mensuels */}
        <Card className="border-border shadow-sm ring-1 ring-border/50 bg-card">
          <CardHeader>
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div>
                <CardTitle className="text-lg font-bold flex items-center gap-2">
                  <Target size={18} className="text-brand" /> Objectifs mensuels
                </CardTitle>
                <CardDescription>Cliquez sur un objectif pour le modifier · Vert ≥ 100 % · Orange 80–99 % · Rouge &lt; 80 %</CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => setTargetYear(y => y - 1)} className="px-2 py-1 rounded text-slate-500 hover:bg-slate-100 text-sm">‹</button>
                <span className="font-bold text-slate-800 min-w-[3rem] text-center">{targetYear}</span>
                <button onClick={() => setTargetYear(y => y + 1)} disabled={targetYear >= currentYear} className="px-2 py-1 rounded text-slate-500 hover:bg-slate-100 text-sm disabled:opacity-30">›</button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {targetsLoading ? (
              <div className="space-y-2">{[...Array(4)].map((_, i) => <div key={i} className="h-10 bg-slate-100 animate-pulse rounded" />)}</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100">
                      <th className="text-left py-2 pr-4 font-semibold text-slate-500 text-xs uppercase tracking-wide">Mois</th>
                      <th className="text-right py-2 px-3 font-semibold text-slate-500 text-xs uppercase tracking-wide">Objectif</th>
                      <th className="text-right py-2 px-3 font-semibold text-slate-500 text-xs uppercase tracking-wide">Réalisé</th>
                      <th className="text-right py-2 pl-3 font-semibold text-slate-500 text-xs uppercase tracking-wide">Atteinte</th>
                      <th className="w-16" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {targets.map(row => {
                      const isEditing = editingMonth === row.month;
                      const badge = row.status === 'exceeded' ? 'bg-green-100 text-green-700'
                        : row.status === 'close'    ? 'bg-orange-100 text-orange-700'
                        : row.status === 'missed'   ? 'bg-red-100 text-red-600'
                        : 'bg-slate-100 text-slate-500';
                      return (
                        <tr key={row.month} className="group hover:bg-slate-50/60 transition-colors">
                          <td className="py-2.5 pr-4 font-medium text-slate-700">{row.label}</td>
                          <td className="py-2.5 px-3 text-right">
                            {isEditing ? (
                              <div className="flex items-center justify-end gap-1">
                                <input
                                  autoFocus
                                  type="text"
                                  value={editValue}
                                  onChange={e => setEditValue(e.target.value)}
                                  onKeyDown={e => { if (e.key === 'Enter') void saveTarget(row.month); if (e.key === 'Escape') setEditingMonth(null); }}
                                  className="w-28 text-right border border-brand rounded px-2 py-0.5 text-sm focus:outline-none focus:ring-1 focus:ring-brand"
                                  placeholder="ex: 1500000"
                                />
                                <button onClick={() => void saveTarget(row.month)} className="text-green-600 hover:text-green-700"><Check size={14} /></button>
                                <button onClick={() => setEditingMonth(null)} className="text-slate-400 hover:text-slate-600"><X size={14} /></button>
                              </div>
                            ) : (
                              <button
                                onClick={() => { setEditingMonth(row.month); setEditValue(row.targetXaf?.toString() ?? ''); }}
                                className="flex items-center gap-1 ml-auto text-slate-700 hover:text-brand group/edit"
                              >
                                {row.targetXaf ? `${row.targetXaf.toLocaleString('fr-FR')} XAF` : <span className="text-slate-400 italic text-xs">Définir</span>}
                                <Pencil size={11} className="opacity-0 group-hover/edit:opacity-60 transition-opacity" />
                              </button>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-right text-slate-600">
                            {row.revenue > 0 ? `${row.revenue.toLocaleString('fr-FR')} XAF` : <span className="text-slate-300">—</span>}
                          </td>
                          <td className="py-2.5 pl-3 text-right">
                            {row.achievementPct !== null ? (
                              <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold ${badge}`}>
                                {row.achievementPct} %
                              </span>
                            ) : <span className="text-slate-300 text-xs">—</span>}
                          </td>
                          <td className="py-2.5 text-right">
                            {row.targetId && (
                              <button
                                onClick={() => void removeTarget(row.targetId!)}
                                className="opacity-0 group-hover:opacity-60 hover:!opacity-100 text-slate-400 hover:text-red-500 transition-all"
                              >
                                <Trash2 size={13} />
                              </button>
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
        <Card className="border-border shadow-sm ring-1 ring-border/50 bg-card">
          <CardHeader>
            <CardTitle className="text-lg font-bold">Performance par Technicien</CardTitle>
            <CardDescription>Productivité et qualité du travail</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {techPerformance.map((tech) => (
                <div key={tech.name} className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-brand/10 text-brand flex items-center justify-center font-bold text-xs">
                        {tech.name.split(' ').map((n: string) => n[0]).join('')}
                      </div>
                      <span className="text-sm font-bold text-foreground">{tech.name}</span>
                    </div>
                    <span className="text-xs font-mono text-muted-foreground">{tech.jobs} OT terminés</span>
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
