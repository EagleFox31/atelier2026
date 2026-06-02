'use client';

import Link from 'next/link';
import { useState } from 'react';
import {
  CheckCircle2,
  Circle,
  ListChecks,
  Loader2,
  Map,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { useGettingStarted } from '@/hooks/use-getting-started';
import { runProductTour } from '@/components/onboarding/ProductTour';
import { GUIDE_ROLE_LABELS } from '@/lib/guide-roles';
import { toast } from 'sonner';

export function GettingStartedNav() {
  const {
    role,
    tasks,
    loading,
    completedCount,
    totalCount,
    allDone,
    dismissed,
    dismiss,
    refresh,
  } = useGettingStarted();

  const [open, setOpen] = useState(false);

  if (totalCount === 0) return null;

  const progressPct = totalCount ? Math.round((completedCount / totalCount) * 100) : 0;
  const remaining = totalCount - completedCount;

  function handleTour() {
    const ok = runProductTour(role);
    if (!ok) {
      toast.message('Élargissez la fenêtre ou utilisez le menu latéral pour lancer le tour.');
      return;
    }
    setOpen(false);
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        data-tour="tour-getting-started"
        className={cn(
          'relative inline-flex h-9 w-9 items-center justify-center rounded-full transition-colors',
          allDone
            ? 'text-green-600 hover:bg-green-500/10'
            : 'text-muted-foreground hover:text-brand hover:bg-brand/10',
        )}
        title="Premiers pas"
        aria-label="Premiers pas — checklist"
      >
        {allDone ? <CheckCircle2 size={18} /> : <ListChecks size={18} />}
        {!dismissed && !allDone && remaining > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand px-0.5 text-[9px] font-bold text-white leading-none">
            {remaining > 9 ? '9+' : remaining}
          </span>
        )}
      </PopoverTrigger>

      <PopoverContent align="end" className="w-[min(92vw,24rem)] p-0 z-[120]">
        <div className="border-b px-4 py-3">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-sm font-semibold">Premiers pas</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {GUIDE_ROLE_LABELS[role]} · {loading ? '…' : `${completedCount}/${totalCount}`}
              </p>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-7 w-7 shrink-0"
              onClick={() => setOpen(false)}
              aria-label="Fermer"
            >
              <X size={14} />
            </Button>
          </div>
          <div className="mt-2 flex justify-between text-[11px] text-muted-foreground">
            <span>Progression</span>
            <span>{progressPct} %</span>
          </div>
          <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-brand transition-all duration-500"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>

        <div className="max-h-[min(60vh,22rem)] overflow-y-auto px-3 py-3 space-y-3">
          <ul className="space-y-2">
            {tasks.map((task) => (
              <li
                key={task.id}
                className={cn(
                  'flex items-start gap-2.5 rounded-lg border px-2.5 py-2',
                  task.done
                    ? 'border-green-200/80 bg-green-50/50 dark:bg-green-950/20'
                    : 'border-border',
                )}
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 shrink-0 animate-spin text-muted-foreground mt-0.5" />
                ) : task.done ? (
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-green-600 mt-0.5" />
                ) : (
                  <Circle className="h-4 w-4 shrink-0 text-muted-foreground mt-0.5" />
                )}
                <div className="min-w-0 flex-1">
                  <p className={cn('text-xs font-medium leading-snug', task.done && 'text-green-800 dark:text-green-300')}>
                    {task.label}
                  </p>
                  <p className="text-[10px] text-muted-foreground mt-0.5 leading-snug">{task.description}</p>
                </div>
                {!task.done && (
                  <Link
                    href={task.href}
                    onClick={() => setOpen(false)}
                    className="shrink-0 inline-flex h-7 items-center rounded-md border px-2 text-[10px] font-medium hover:bg-accent"
                  >
                    Aller
                  </Link>
                )}
              </li>
            ))}
          </ul>

          {allDone && (
            <p className="text-xs text-green-700 dark:text-green-400 text-center py-1">
              Bases validées — le guide ? reste disponible sur chaque écran.
            </p>
          )}
        </div>

        <div className="flex flex-wrap gap-2 border-t px-3 py-3">
          <Button
            type="button"
            size="sm"
            className="flex-1 min-w-[8rem] gap-1.5 bg-brand hover:bg-brand-hover text-white text-xs"
            onClick={handleTour}
          >
            <Map size={13} />
            Tour interactif
          </Button>
          <Button type="button" size="sm" variant="outline" className="text-xs" onClick={() => void refresh()}>
            Actualiser
          </Button>
          {!allDone && (
            <Button type="button" size="sm" variant="ghost" className="text-xs" onClick={dismiss}>
              Masquer le badge
            </Button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
