'use client';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Stethoscope, Plus, Clock } from 'lucide-react';

interface TechDiagnosticBannerProps {
  status: string;
  canDiagnose: boolean;
  observationCount: number;
  onStartDiagnosis: () => void;
  onAddConstat: () => void;
}

export function TechDiagnosticBanner({
  status,
  canDiagnose,
  observationCount,
  onStartDiagnosis,
  onAddConstat,
}: TechDiagnosticBannerProps) {
  if (!canDiagnose) return null;

  if (status === 'RECEIVED') {
    return (
      <div className="rounded-2xl border border-brand/30 bg-brand/5 p-4 md:p-5 flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="flex-1 min-w-0">
          <p className="font-bold text-foreground">Prêt pour le diagnostic ?</p>
          <p className="text-sm text-muted-foreground mt-1">
            Consultez l&apos;inspection réception ci-dessus, puis saisissez votre premier constat pour démarrer.
          </p>
        </div>
        <Button
          className="bg-brand hover:bg-brand-hover font-bold gap-2 shrink-0 w-full sm:w-auto"
          onClick={onStartDiagnosis}
        >
          <Stethoscope size={18} />
          Commencer le diagnostic
        </Button>
      </div>
    );
  }

  if (status === 'DIAGNOSING') {
    return (
      <div className={cn(
        'rounded-2xl border p-4 md:p-5 flex flex-col sm:flex-row sm:items-center gap-4',
        observationCount > 0
          ? 'border-indigo-200 bg-indigo-50/50 dark:bg-indigo-950/20'
          : 'border-brand/30 bg-brand/5',
      )}>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-foreground">
            Diagnostic en cours
            {observationCount > 0 && (
              <span className="text-muted-foreground font-normal"> · {observationCount} constat{observationCount > 1 ? 's' : ''}</span>
            )}
          </p>
          <p className="text-sm text-muted-foreground mt-1 flex items-start gap-1.5">
            {observationCount > 0 ? (
              <>
                <Clock size={14} className="shrink-0 mt-0.5 text-indigo-500" />
                Diagnostic documenté — en attente du chef d&apos;atelier pour le devis.
              </>
            ) : (
              'Ajoutez votre constat technique pour documenter le diagnostic.'
            )}
          </p>
        </div>
        <Button
          variant={observationCount > 0 ? 'outline' : 'default'}
          className={cn(
            'font-bold gap-2 shrink-0 w-full sm:w-auto',
            observationCount === 0 && 'bg-brand hover:bg-brand-hover',
          )}
          onClick={onAddConstat}
        >
          <Plus size={18} />
          Ajouter un constat
        </Button>
      </div>
    );
  }

  return null;
}
