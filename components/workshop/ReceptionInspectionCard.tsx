'use client';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { AlertTriangle, CheckCircle2, ClipboardCheck, Gauge, Fuel } from 'lucide-react';

const FUEL_LABELS: Record<number, string> = {
  0: 'Vide (E)', 1: '1/8', 2: '1/4', 3: '3/8', 4: '1/2', 5: '5/8', 6: '3/4', 7: '7/8', 8: 'Plein (F)',
};

const CATEGORY_LABELS: Record<string, string> = {
  EXTERIEUR: 'Extérieur',
  SOUS_CAPOT: 'Sous capot',
  INTERIEUR: 'Intérieur',
  DOCUMENTS: 'Documents',
};

const RESULT_BADGE: Record<string, { label: string; className: string }> = {
  OK:       { label: 'OK',        className: 'bg-green-50 text-green-700 border-green-200' },
  WARNING:  { label: 'Attention', className: 'bg-amber-50 text-amber-700 border-amber-200' },
  CRITICAL: { label: 'Critique',  className: 'bg-red-50 text-red-700 border-red-200' },
  NA:       { label: 'N/A',       className: 'bg-muted text-muted-foreground border-border' },
};

export type ReceptionCheckData = {
  id: string;
  checkedAt: string;
  mileageAtReception: number;
  fuelLevel?: number | null;
  globalNotes?: string | null;
  checker?: { firstName?: string; lastName?: string } | null;
  checkItems?: Array<{
    id: string;
    result: string;
    note?: string | null;
    catalog?: { labelFr?: string; category?: string; sortOrder?: number } | null;
  }>;
};

interface ReceptionInspectionCardProps {
  receptionChecks?: ReceptionCheckData[] | null;
  /** Mettre en avant pour le technicien en phase diagnostic */
  highlight?: boolean;
}

export function ReceptionInspectionCard({ receptionChecks, highlight }: ReceptionInspectionCardProps) {
  const check = receptionChecks?.[0];
  if (!check) {
    return (
      <Card className={cn('rounded-2xl border-border shadow-sm', highlight && 'border-amber-200/60')}>
        <CardHeader className="pb-2">
          <CardTitle className="text-[10px] font-bold flex items-center gap-2 text-muted-foreground uppercase tracking-widest">
            <ClipboardCheck size={12} className="text-amber-500" />
            Inspection réception
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground italic">Aucune fiche de réception enregistrée.</p>
        </CardContent>
      </Card>
    );
  }

  const items = [...(check.checkItems ?? [])].sort(
    (a, b) => (a.catalog?.sortOrder ?? 0) - (b.catalog?.sortOrder ?? 0),
  );
  const alerts = items.filter(i => i.result === 'WARNING' || i.result === 'CRITICAL');
  const okItems = items.filter(i => i.result === 'OK' || i.result === 'NA');
  const checkerName = check.checker
    ? [check.checker.firstName, check.checker.lastName].filter(Boolean).join(' ')
    : null;

  const byCategory = (list: typeof items) => {
    const groups: Record<string, typeof items> = {};
    for (const item of list) {
      const cat = item.catalog?.category ?? 'AUTRE';
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(item);
    }
    return groups;
  };

  return (
    <Card className={cn(
      'rounded-2xl border-border shadow-sm',
      highlight && 'border-amber-300/80 ring-1 ring-amber-200/50 bg-amber-50/20 dark:bg-amber-950/10',
    )}>
      <CardHeader className="pb-2">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <CardTitle className="text-[10px] font-bold flex items-center gap-2 text-muted-foreground uppercase tracking-widest">
            <ClipboardCheck size={12} className="text-amber-500" />
            Inspection réception
          </CardTitle>
          <span className="text-[10px] text-muted-foreground">
            {new Date(check.checkedAt).toLocaleDateString('fr-FR', {
              day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
            })}
            {checkerName ? ` · ${checkerName}` : ''}
          </span>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-3 text-xs">
          <span className="inline-flex items-center gap-1.5 rounded-lg bg-muted/60 px-2.5 py-1.5 font-medium">
            <Gauge size={12} className="text-brand" />
            {check.mileageAtReception.toLocaleString('fr-FR')} km
          </span>
          {check.fuelLevel != null && (
            <span className="inline-flex items-center gap-1.5 rounded-lg bg-muted/60 px-2.5 py-1.5 font-medium">
              <Fuel size={12} className="text-brand" />
              {FUEL_LABELS[check.fuelLevel] ?? check.fuelLevel}
            </span>
          )}
          {alerts.length > 0 && (
            <span className="inline-flex items-center gap-1.5 rounded-lg bg-amber-100 dark:bg-amber-950/40 px-2.5 py-1.5 font-bold text-amber-800 dark:text-amber-300">
              <AlertTriangle size={12} />
              {alerts.length} point{alerts.length > 1 ? 's' : ''} à vérifier
            </span>
          )}
        </div>

        {check.globalNotes && (
          <div className="rounded-xl bg-muted/40 border border-border/60 p-3">
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">Notes réception</p>
            <p className="text-sm text-foreground whitespace-pre-wrap">{check.globalNotes}</p>
          </div>
        )}

        {alerts.length > 0 && (
          <div className="space-y-2">
            <p className="text-[10px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400 flex items-center gap-1">
              <AlertTriangle size={11} /> Points signalés à l&apos;entrée
            </p>
            {Object.entries(byCategory(alerts)).map(([cat, catItems]) => (
              <div key={cat} className="space-y-1.5">
                <p className="text-[10px] font-semibold text-muted-foreground">
                  {CATEGORY_LABELS[cat] ?? cat}
                </p>
                {catItems.map(item => {
                  const badge = RESULT_BADGE[item.result] ?? RESULT_BADGE.NA;
                  return (
                    <div key={item.id} className="flex items-start gap-2 rounded-lg border border-border/60 bg-card p-2.5">
                      <Badge variant="outline" className={cn('text-[9px] shrink-0 border', badge.className)}>
                        {badge.label}
                      </Badge>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-foreground">{item.catalog?.labelFr ?? '—'}</p>
                        {item.note && (
                          <p className="text-xs text-muted-foreground mt-0.5">{item.note}</p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        )}

        {okItems.length > 0 && (
          <details className="group">
            <summary className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground cursor-pointer list-none flex items-center gap-1">
              <CheckCircle2 size={11} className="text-green-600" />
              {okItems.length} point{okItems.length > 1 ? 's' : ''} OK / N/A
              <span className="text-muted-foreground/50 group-open:hidden"> · afficher</span>
            </summary>
            <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-1.5">
              {okItems.map(item => {
                const badge = RESULT_BADGE[item.result] ?? RESULT_BADGE.NA;
                return (
                  <div key={item.id} className="flex items-center gap-2 text-xs text-muted-foreground py-1">
                    <Badge variant="outline" className={cn('text-[9px] border py-0', badge.className)}>
                      {badge.label}
                    </Badge>
                    <span className="truncate">{item.catalog?.labelFr}</span>
                  </div>
                );
              })}
            </div>
          </details>
        )}
      </CardContent>
    </Card>
  );
}
