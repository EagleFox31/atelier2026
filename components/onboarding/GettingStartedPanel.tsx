'use client';

import Link from 'next/link';
import {
  CheckCircle2,
  Circle,
  Loader2,
  Map,
  ChevronDown,
  ChevronUp,
  X,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useGettingStarted } from '@/hooks/use-getting-started';
import { runProductTour } from '@/components/onboarding/ProductTour';
import { useState } from 'react';
import { toast } from 'sonner';

export function GettingStartedPanel({ className }: { className?: string }) {
  const {
    role,
    tasks,
    loading,
    completedCount,
    totalCount,
    allDone,
    dismissed,
    dismiss,
    resetDismiss,
    refresh,
  } = useGettingStarted();

  const [collapsed, setCollapsed] = useState(false);

  if (totalCount === 0) return null;
  if (dismissed && !allDone) return null;

  const progressPct = totalCount ? Math.round((completedCount / totalCount) * 100) : 0;

  function handleTour() {
    const ok = runProductTour(role);
    if (!ok) {
      toast.message('Élargissez la fenêtre ou utilisez le menu latéral pour lancer le tour.');
    }
  }

  if (allDone && dismissed) return null;

  return (
    <Card
      id="getting-started"
      data-tour="tour-getting-started"
      className={cn(
        'border-brand/25 bg-gradient-to-br from-brand/5 to-transparent shadow-sm ring-1 ring-brand/10',
        className,
      )}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <CardTitle className="text-base font-bold flex items-center gap-2">
              Premiers pas
              {allDone && (
                <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0" aria-hidden />
              )}
            </CardTitle>
            <CardDescription className="mt-1">
              {allDone
                ? 'Bravo — vous avez validé les bases. Le guide ? reste disponible sur chaque écran.'
                : 'Checklist automatique + tour interactif pour démarrer.'}
            </CardDescription>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setCollapsed((v) => !v)}
              aria-label={collapsed ? 'Déplier' : 'Replier'}
            >
              {collapsed ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
            </Button>
            {!allDone && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground"
                onClick={dismiss}
                aria-label="Masquer la checklist"
              >
                <X size={16} />
              </Button>
            )}
          </div>
        </div>
        {!collapsed && (
          <div className="mt-3 space-y-2">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>
                {loading ? 'Vérification…' : `${completedCount} / ${totalCount} terminé${completedCount > 1 ? 's' : ''}`}
              </span>
              <span>{progressPct} %</span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-brand transition-all duration-500"
                style={{ width: `${progressPct}%` }}
              />
            </div>
          </div>
        )}
      </CardHeader>

      {!collapsed && (
        <CardContent className="space-y-4 pt-0">
          <ul className="space-y-2">
            {tasks.map((task) => (
              <li
                key={task.id}
                className={cn(
                  'flex items-start gap-3 rounded-lg border px-3 py-2.5 transition-colors',
                  task.done
                    ? 'border-green-200/80 bg-green-50/50 dark:bg-green-950/20'
                    : 'border-border bg-card/80',
                )}
              >
                {loading ? (
                  <Loader2 className="h-5 w-5 shrink-0 animate-spin text-muted-foreground mt-0.5" />
                ) : task.done ? (
                  <CheckCircle2 className="h-5 w-5 shrink-0 text-green-600 mt-0.5" />
                ) : (
                  <Circle className="h-5 w-5 shrink-0 text-muted-foreground mt-0.5" />
                )}
                <div className="min-w-0 flex-1">
                  <p className={cn('text-sm font-medium', task.done && 'text-green-800 dark:text-green-300')}>
                    {task.label}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5 leading-snug">{task.description}</p>
                </div>
                {!task.done && (
                  <Link
                    href={task.href}
                    className="shrink-0 inline-flex h-8 items-center rounded-md border px-2.5 text-xs font-medium hover:bg-accent"
                  >
                    Aller
                  </Link>
                )}
              </li>
            ))}
          </ul>

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              className="gap-1.5 bg-brand hover:bg-brand-hover text-white"
              onClick={handleTour}
            >
              <Map size={14} />
              Lancer le tour interactif
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={() => void refresh()}>
              Actualiser
            </Button>
            {allDone && (
              <Button type="button" size="sm" variant="ghost" onClick={dismiss}>
                Masquer la checklist
              </Button>
            )}
            {dismissed && allDone && (
              <Button type="button" size="sm" variant="ghost" onClick={resetDismiss}>
                Réafficher
              </Button>
            )}
          </div>
        </CardContent>
      )}
    </Card>
  );
}
