'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { superAdminApi, type TenantSummary } from '@/lib/api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Building2, MapPin, Users, Wrench, RefreshCw,
  ChevronDown, ChevronRight, PowerOff, Power, Calendar,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

const PLAN_LABELS: Record<string, { label: string; color: string }> = {
  starter:    { label: 'Starter',    color: 'bg-slate-100 text-slate-600' },
  pro:        { label: 'Pro',        color: 'bg-blue-100 text-blue-700' },
  enterprise: { label: 'Enterprise', color: 'bg-purple-100 text-purple-700' },
};

function TenantCard({ tenant, onRefresh }: { tenant: TenantSummary; onRefresh: () => void }) {
  const [expanded, setExpanded]   = useState(true);
  const [toggling, setToggling]   = useState(false);
  const isActive = tenant.status === 'active';
  const plan     = PLAN_LABELS[tenant.plan] ?? { label: tenant.plan, color: 'bg-slate-100 text-slate-600' };

  async function handleToggle() {
    setToggling(true);
    try {
      const res = await superAdminApi.toggleTenantStatus(tenant.id);
      toast.success(res.status === 'suspended'
        ? `${tenant.name} suspendu — tous les utilisateurs sont bloqués`
        : `${tenant.name} réactivé`);
      onRefresh();
    } catch {
      toast.error('Erreur lors du changement de statut');
    } finally {
      setToggling(false);
    }
  }

  return (
    <div className={cn(
      'rounded-2xl border bg-white shadow-sm overflow-hidden transition-all',
      !isActive && 'opacity-60 border-red-200',
    )}>
      {/* Header tenant */}
      <div className="flex items-start justify-between gap-4 p-5">
        <div className="flex items-center gap-3 min-w-0">
          <div className={cn(
            'w-10 h-10 rounded-xl flex items-center justify-center shrink-0',
            isActive ? 'bg-brand/10 text-brand' : 'bg-red-50 text-red-400',
          )}>
            <Building2 size={20} />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-bold text-slate-900 text-base">{tenant.name}</h3>
              <span className={cn('text-[11px] font-semibold px-2 py-0.5 rounded-full', plan.color)}>
                {plan.label}
              </span>
              <span className={cn(
                'text-[11px] font-semibold px-2 py-0.5 rounded-full',
                isActive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600',
              )}>
                {isActive ? 'Actif' : 'Suspendu'}
              </span>
            </div>
            <p className="text-sm text-slate-500 truncate">{tenant.email}</p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {/* Méta */}
          <div className="hidden sm:flex items-center gap-4 text-sm text-slate-400 mr-2">
            <span className="flex items-center gap-1">
              <Users size={13} /> {tenant.userCount}
            </span>
            <span className="flex items-center gap-1">
              <MapPin size={13} /> {tenant.garageCount}
            </span>
            <span className="flex items-center gap-1">
              <Calendar size={13} />
              {new Date(tenant.createdAt).toLocaleDateString('fr-FR')}
            </span>
          </div>

          <Button
            size="sm"
            variant="ghost"
            disabled={toggling}
            onClick={handleToggle}
            className={cn(
              'gap-1.5 text-xs h-8',
              isActive ? 'text-red-500 hover:bg-red-50' : 'text-green-600 hover:bg-green-50',
            )}
          >
            {isActive ? <PowerOff size={13} /> : <Power size={13} />}
            {toggling ? '...' : isActive ? 'Suspendre' : 'Réactiver'}
          </Button>

          <button
            onClick={() => setExpanded(v => !v)}
            className="text-slate-400 hover:text-slate-600 p-1"
          >
            {expanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
          </button>
        </div>
      </div>

      {/* Garages */}
      {expanded && (
        <div className="border-t border-slate-100 divide-y divide-slate-50">
          {tenant.garages.length === 0 ? (
            <p className="px-5 py-3 text-sm text-slate-400 italic">Aucun garage enregistré</p>
          ) : (
            tenant.garages.map(garage => (
              <div key={garage.id} className="flex items-center gap-3 px-5 py-3">
                <MapPin size={15} className="text-slate-400 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-800">{garage.name}</p>
                  <p className="text-xs text-slate-400">{garage.city}</p>
                </div>
                <div className="flex items-center gap-3 text-xs text-slate-500 shrink-0">
                  <span className="flex items-center gap-1">
                    <Wrench size={12} />
                    <span className={cn('font-semibold', garage.activeOTs > 0 && 'text-brand')}>
                      {garage.activeOTs}
                    </span>
                    <span className="text-slate-400">/ {garage.totalOTs} OT</span>
                  </span>
                  <span className={cn(
                    'px-2 py-0.5 rounded-full text-[11px] font-medium',
                    garage.status === 'active' ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-500',
                  )}>
                    {garage.status === 'active' ? 'Actif' : 'Suspendu'}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

export default function TenantsPage() {
  const [tenants, setTenants] = useState<TenantSummary[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchTenants = useCallback(async () => {
    setLoading(true);
    try {
      const data = await superAdminApi.listTenants();
      setTenants(data);
    } catch {
      toast.error('Erreur lors du chargement des tenants');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchTenants(); }, [fetchTenants]);

  const total        = tenants.length;
  const active       = tenants.filter(t => t.status === 'active').length;
  const totalUsers   = tenants.reduce((s, t) => s + t.userCount, 0);
  const totalGarages = tenants.reduce((s, t) => s + t.garageCount, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Tenants</h1>
          <p className="text-slate-500 text-sm">Vue plateforme — tous les clients Atelier Maître</p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchTenants} className="gap-2">
          <RefreshCw size={14} /> Actualiser
        </Button>
      </div>

      {/* Stats rapides */}
      {!loading && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: 'Tenants',  value: total,        icon: Building2, color: 'text-brand bg-brand/10' },
            { label: 'Actifs',   value: active,       icon: Power,     color: 'text-green-600 bg-green-50' },
            { label: 'Garages',  value: totalGarages, icon: MapPin,    color: 'text-orange-600 bg-orange-50' },
            { label: 'Utilisateurs', value: totalUsers, icon: Users,   color: 'text-purple-600 bg-purple-50' },
          ].map(({ label, value, icon: Icon, color }) => (
            <div key={label} className="bg-white rounded-xl border p-4 flex items-center gap-3 shadow-sm">
              <div className={cn('w-9 h-9 rounded-lg flex items-center justify-center shrink-0', color)}>
                <Icon size={18} />
              </div>
              <div>
                <p className="text-xs text-slate-500">{label}</p>
                <p className="text-xl font-bold text-slate-900">{value}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Liste */}
      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-32 w-full rounded-2xl" />)}
        </div>
      ) : tenants.length === 0 ? (
        <div className="text-center py-16 text-slate-400">
          <Building2 size={40} className="mx-auto mb-3 opacity-30" />
          <p className="font-medium">Aucun tenant enregistré</p>
          <p className="text-sm mt-1">Les inscriptions via /inscription apparaîtront ici.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {tenants.map(tenant => (
            <TenantCard key={tenant.id} tenant={tenant} onRefresh={fetchTenants} />
          ))}
        </div>
      )}
    </div>
  );
}
