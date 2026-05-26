'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { History, Search, Clock, RefreshCw, AlertCircle } from "lucide-react";
import { auditApi, handleApiError } from "@/lib/api";

const ACTION_COLORS: Record<string, string> = {
  STATUS_CHANGE:   'bg-blue-50 text-blue-700 border-blue-200',
  CREATE:          'bg-green-50 text-green-700 border-green-200',
  UPDATE:          'bg-amber-50 text-amber-700 border-amber-200',
  DELETE:          'bg-red-50 text-red-700 border-red-200',
  INSERT:          'bg-green-50 text-green-700 border-green-200',
};

const ENTITY_LABELS: Record<string, string> = {
  service_orders:   'OT',
  customers:        'Client',
  vehicles:         'Véhicule',
  quotes:           'Devis',
  invoices:         'Facture',
  stock_movements:  'Stock',
  payments:         'Paiement',
};

export default function AuditPage() {
  const [logs, setLogs]           = useState<any[]>([]);
  const [loading, setLoading]     = useState(true);
  const [search, setSearch]       = useState('');
  const [entityType, setEntityType] = useState('all');
  const [offset, setOffset]       = useState(0);
  const LIMIT = 30;

  const load = useCallback(async (reset = true) => {
    setLoading(true);
    try {
      const newOffset = reset ? 0 : offset;
      const data = await auditApi.logs({
        entityType: entityType !== 'all' ? entityType : undefined,
        action:     search || undefined,
        limit:      LIMIT,
        offset:     newOffset,
      }) as any[];
      if (reset) { setLogs(data); setOffset(LIMIT); }
      else        { setLogs(prev => [...prev, ...data]); setOffset(newOffset + LIMIT); }
    } catch (err: unknown) {
      handleApiError(err, 'Impossible de charger les logs');
    } finally {
      setLoading(false);
    }
  }, [entityType, search, offset]);

  useEffect(() => { load(true); }, [entityType, search]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Journal d&apos;Audit</h1>
          <p className="text-muted-foreground">Traçabilité complète des actions effectuées sur le système</p>
        </div>
        <div className="flex gap-2">
          <Select value={entityType} onValueChange={v => { setEntityType(v ?? 'all'); }}>
            <SelectTrigger className="w-44 bg-muted border-border">
              <SelectValue placeholder="Toutes les entités" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toutes</SelectItem>
              {Object.entries(ENTITY_LABELS).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" size="icon" onClick={() => load(true)} className="border-border">
            <RefreshCw size={16} />
          </Button>
        </div>
      </div>

      <Card className="border-border shadow-sm">
        <CardHeader className="pb-4">
          <div className="relative w-full md:w-96">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
            <Input
              placeholder="Filtrer par action (STATUS_CHANGE, CREATE…)"
              className="pl-10 bg-muted border-border"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
        </CardHeader>
        <CardContent>
          {loading && logs.length === 0
            ? <div className="space-y-4">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="flex items-start gap-6">
                    <Skeleton className="w-10 h-10 rounded-full shrink-0" />
                    <Skeleton className="flex-1 h-20 rounded-xl" />
                  </div>
                ))}
              </div>
            : logs.length === 0
            ? <div className="flex flex-col items-center gap-3 py-16 text-muted-foreground">
                <AlertCircle size={32} strokeWidth={1} />
                <p className="text-sm">Aucun log trouvé</p>
              </div>
            : <div className="space-y-6 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-border before:to-transparent">
                {logs.map(log => {
                  const actionColor = ACTION_COLORS[log.action] ?? 'bg-slate-50 text-slate-600 border-slate-200';
                  const entityLabel = ENTITY_LABELS[log.entityType] ?? log.entityType;
                  const performer = log.performer
                    ? `${log.performer.firstName} ${log.performer.lastName}`
                    : 'Système';
                  const changes = log.fieldChanges
                    ? Object.entries(log.fieldChanges as Record<string, { from: unknown; to: unknown }>)
                        .slice(0, 3)
                        .map(([k, v]) => `${k}: ${String(v.from ?? '—')} → ${String(v.to ?? '—')}`)
                        .join(' · ')
                    : null;

                  return (
                    <div key={`${log.id}-${log.performedAt}`} className="relative flex items-start gap-6 group">
                      <div className="absolute left-0 w-10 h-10 rounded-full bg-card border-2 border-border flex items-center justify-center z-10 group-hover:border-brand transition-colors">
                        <Clock size={16} className="text-muted-foreground group-hover:text-brand transition-colors" />
                      </div>
                      <div className="flex-1 ml-12 bg-muted/30 p-4 rounded-xl border border-border hover:border-brand/30 transition-all">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 mb-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Badge className={`text-[10px] font-bold border ${actionColor}`}>{log.action}</Badge>
                            <Badge variant="outline" className="text-[10px] border-border">{entityLabel}</Badge>
                            <span className="text-xs font-mono text-muted-foreground truncate max-w-[160px]">
                              {String(log.entityId).slice(0, 8)}…
                            </span>
                          </div>
                          <span className="text-xs text-muted-foreground shrink-0">
                            {new Date(log.performedAt).toLocaleString('fr-FR')}
                          </span>
                        </div>
                        {changes && (
                          <p className="text-xs text-muted-foreground mt-1 font-mono truncate">{changes}</p>
                        )}
                        <div className="flex items-center gap-2 mt-3 pt-3 border-t border-border">
                          <div className="w-5 h-5 rounded-full bg-brand/10 flex items-center justify-center text-[10px] font-bold text-brand">
                            {performer[0]}
                          </div>
                          <span className="text-xs text-muted-foreground">
                            Par <span className="font-bold text-foreground">{performer}</span>
                          </span>
                          {log.metadata && (
                            <span className="text-xs text-muted-foreground ml-auto">
                              {JSON.stringify(log.metadata).slice(0, 60)}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
                <Button
                  variant="ghost"
                  className="w-full mt-4 text-muted-foreground hover:text-brand"
                  onClick={() => load(false)}
                  disabled={loading}
                >
                  {loading ? <RefreshCw size={14} className="animate-spin mr-2" /> : <History size={14} className="mr-2" />}
                  Charger plus
                </Button>
              </div>
          }
        </CardContent>
      </Card>
    </div>
  );
}
