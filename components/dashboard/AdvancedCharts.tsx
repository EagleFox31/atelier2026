'use client';

import React, { useEffect, useState } from 'react';
import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  Cell,
  PieChart,
  Pie,
} from 'recharts';
import { billingApi, workshopApi, reportsApi } from "@/lib/api";

export function RevenueChart() {
  const [data, setData] = useState<{ day: string; amount: number }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        const invoices = await billingApi.listInvoices() as any[];
        const daysOfWeek = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
        const chartData = [];
        
        for (let i = 6; i >= 0; i--) {
          const d = new Date();
          d.setDate(d.getDate() - i);
          d.setHours(0, 0, 0, 0);
          
          const dayName = daysOfWeek[d.getDay()];
          const dateStr = d.toDateString();
          
          const amount = invoices
            .filter(inv => {
              if (inv.status !== 'PAID' || !inv.paidAt) return false;
              const paidDate = new Date(inv.paidAt);
              paidDate.setHours(0, 0, 0, 0);
              return paidDate.toDateString() === dateStr;
            })
            .reduce((sum, inv) => sum + Number(inv.totalXaf || 0), 0);
            
          chartData.push({ day: dayName, amount });
        }
        setData(chartData);
      } catch (err) {
        console.error("Error loading revenue chart data:", err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  if (loading) {
    return (
      <div className="h-[240px] w-full flex items-center justify-center text-muted-foreground text-sm">
        Chargement du graphique...
      </div>
    );
  }

  return (
    <div className="h-[240px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="var(--brand)" stopOpacity={0.3}/>
              <stop offset="95%" stopColor="var(--brand)" stopOpacity={0}/>
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
          <XAxis 
            dataKey="day" 
            axisLine={false} 
            tickLine={false} 
            tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 600 }}
            dy={10}
          />
          <YAxis 
            hide 
          />
          <Tooltip 
            contentStyle={{ 
              backgroundColor: 'rgba(255, 255, 255, 0.95)', 
              backdropFilter: 'blur(8px)',
              borderRadius: '12px', 
              border: '1px solid var(--border)', 
              boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)',
              fontSize: '12px',
              fontWeight: 'bold',
              color: 'var(--foreground)'
            }}
            itemStyle={{ color: 'var(--foreground)' }}
            formatter={((value: number) => [`${value.toLocaleString()} XAF`, 'Revenu']) as any}
          />
          <Area 
            type="monotone" 
            dataKey="amount" 
            stroke="var(--brand)" 
            strokeWidth={3}
            fillOpacity={1} 
            fill="url(#colorRev)" 
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export function StatusDistributionChart() {
  const [data, setData] = useState<{ name: string; value: number; color: string }[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        const ots = await workshopApi.listOTs() as any[];
        
        let enCours = 0;
        let attentePieces = 0;
        let termines = 0;
        let recus = 0;
        
        ots.forEach(o => {
          if (o.status === 'IN_PROGRESS') {
            enCours++;
          } else if (['QUOTE_PENDING', 'QUOTE_APPROVED'].includes(o.status)) {
            attentePieces++;
          } else if (['READY', 'INVOICED', 'CLOSED'].includes(o.status)) {
            termines++;
          } else if (['RECEIVED', 'DIAGNOSING'].includes(o.status)) {
            recus++;
          }
        });
        
        setData([
          { name: 'En cours', value: enCours, color: 'var(--brand)' },
          { name: 'Attente pièces', value: attentePieces, color: '#f59e0b' },
          { name: 'Terminés', value: termines, color: '#10b981' },
          { name: 'Reçus', value: recus, color: '#64748b' },
        ]);
        setTotal(ots.length);
      } catch (err) {
        console.error("Error loading status distribution chart data:", err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  if (loading) {
    return (
      <div className="h-[200px] w-full flex items-center justify-center text-muted-foreground text-sm">
        Chargement...
      </div>
    );
  }

  return (
    <div className="h-[200px] w-full flex items-center justify-center relative">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={60}
            outerRadius={80}
            paddingAngle={5}
            dataKey="value"
          >
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip 
            contentStyle={{ 
              backgroundColor: 'rgba(255, 255, 255, 0.95)', 
              backdropFilter: 'blur(8px)',
              borderRadius: '12px', 
              border: '1px solid var(--border)',
              color: 'var(--foreground)'
            }}
            itemStyle={{ color: 'var(--foreground)' }}
          />
        </PieChart>
      </ResponsiveContainer>
      <div className="absolute flex flex-col items-center justify-center pointer-events-none">
        <span className="text-2xl font-bold text-foreground">{total}</span>
        <span className="text-[10px] text-muted-foreground uppercase font-bold">Total OT</span>
      </div>
    </div>
  );
}

export function TechEfficiencyChart() {
  const [data, setData] = useState<{ name: string; efficiency: number; estimatedHours: number; actualHours: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [unavailableReason, setUnavailableReason] = useState<string | null>(null);

  useEffect(() => {
    async function loadData() {
      try {
        const performance = await reportsApi.performance() as Record<string, { estimatedHours: number; actualHours: number }>;

        const chartData = Object.entries(performance)
          .map(([fullName, perf]) => {
            const estimatedHours = Number(perf?.estimatedHours ?? 0);
            const actualHours = Number(perf?.actualHours ?? 0);
            if (actualHours <= 0) return null;
            const efficiency = Math.round((estimatedHours / actualHours) * 100);
            return {
              name: fullName,
              efficiency,
              estimatedHours,
              actualHours,
            };
          })
          .filter((row): row is { name: string; efficiency: number; estimatedHours: number; actualHours: number } => !!row)
          .sort((a, b) => b.actualHours - a.actualHours)
          .slice(0, 6);

        if (chartData.length === 0) {
          setUnavailableReason('Aucune donnée d’efficacité disponible sur la période.');
        } else {
          setUnavailableReason(null);
        }
        setData(chartData);
      } catch (err) {
        setData([]);
        setUnavailableReason("Données non disponibles pour ce profil.");
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  if (loading) {
    return (
      <div className="h-[200px] w-full flex items-center justify-center text-muted-foreground text-sm">
        Chargement...
      </div>
    );
  }

  if (unavailableReason) {
    return (
      <div className="h-[200px] w-full flex items-center justify-center text-center text-muted-foreground text-sm px-4">
        {unavailableReason}
      </div>
    );
  }

  return (
    <div className="h-[200px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ left: -20, right: 20 }}>
          <XAxis type="number" hide />
          <YAxis 
            dataKey="name" 
            type="category" 
            axisLine={false} 
            tickLine={false}
            tick={{ fontSize: 11, fill: '#64748b', fontWeight: 600 }}
          />
          <Tooltip 
            cursor={{ fill: 'rgba(0,0,0,0.02)' }}
            contentStyle={{ 
              backgroundColor: 'rgba(255, 255, 255, 0.95)', 
              backdropFilter: 'blur(8px)',
              borderRadius: '12px', 
              border: '1px solid var(--border)',
              color: 'var(--foreground)'
            }}
            itemStyle={{ color: 'var(--foreground)' }}
            formatter={((value: number, _name: string, payload: { payload: { estimatedHours: number; actualHours: number } }) => {
              const p = payload.payload;
              return [`${value}% (estimé ${p.estimatedHours.toFixed(1)}h / réel ${p.actualHours.toFixed(1)}h)`, 'Efficacité'];
            }) as any}
          />
          <Bar 
            dataKey="efficiency" 
            fill="var(--brand)" 
            radius={[0, 4, 4, 0]} 
            barSize={12}
          >
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.efficiency > 90 ? '#10b981' : 'var(--brand)'} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
