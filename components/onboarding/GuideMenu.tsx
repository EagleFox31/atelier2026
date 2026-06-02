'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { CircleHelp, ChevronRight, Lightbulb, Map } from 'lucide-react';
import { runProductTour } from '@/components/onboarding/ProductTour';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/auth-context';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  getFallbackGuide,
  getPageGuide,
  getProfileGuideIndex,
} from '@/lib/guide-content';
import { GUIDE_ROLE_LABELS, resolveGuideRole } from '@/lib/guide-roles';
import { cn } from '@/lib/utils';

export function GuideMenu() {
  const pathname = usePathname();
  const { user } = useAuth();
  const role = resolveGuideRole(user?.roles ?? []);

  const guide = getPageGuide(pathname, role) ?? getFallbackGuide(pathname, role);
  const index = getProfileGuideIndex(role).filter((e) => {
    const base = pathname.split('?')[0];
    return e.href !== base && !base.startsWith(`${e.href}/`);
  });

  return (
    <Popover>
      <PopoverTrigger
        className="inline-flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground hover:text-brand hover:bg-brand/10 transition-colors"
        title="Guide — aide sur cette page"
        aria-label="Ouvrir le guide"
      >
        <CircleHelp size={18} />
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[min(92vw,28rem)] p-0 z-[120]">
        <div className="border-b px-4 py-3">
          <p className="text-sm font-semibold text-foreground">{guide.title}</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Profil : {GUIDE_ROLE_LABELS[role]}
          </p>
        </div>

        <div className="max-h-[min(70vh,32rem)] overflow-y-auto px-4 py-3 space-y-4">
          <p className="text-sm leading-relaxed text-muted-foreground">{guide.intro}</p>

          {guide.canDo.length > 0 && (
            <section>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-brand mb-2">
                Ce que vous pouvez faire ici
              </h3>
              <ul className="space-y-1.5 text-sm text-foreground">
                {guide.canDo.map((item) => (
                  <li key={item} className="flex gap-2 leading-snug">
                    <span className="text-brand mt-0.5 shrink-0">•</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {guide.steps.length > 0 && (
            <section>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                Marche à suivre
              </h3>
              <ol className="space-y-2 text-sm text-foreground list-decimal list-inside">
                {guide.steps.map((step, i) => (
                  <li key={i} className="leading-snug pl-0.5">
                    {step}
                  </li>
                ))}
              </ol>
            </section>
          )}

          {guide.tips && guide.tips.length > 0 && (
            <section className="rounded-lg border border-amber-200/60 bg-amber-50/80 dark:bg-amber-950/20 dark:border-amber-800/40 px-3 py-2.5">
              <div className="flex items-center gap-1.5 text-amber-800 dark:text-amber-200 mb-1.5">
                <Lightbulb size={14} />
                <span className="text-xs font-semibold">Bon à savoir</span>
              </div>
              <ul className="space-y-1 text-xs text-amber-900/90 dark:text-amber-100/90">
                {guide.tips.map((tip) => (
                  <li key={tip}>{tip}</li>
                ))}
              </ul>
            </section>
          )}

          {guide.related && guide.related.length > 0 && (
            <section>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                Pages liées
              </h3>
              <div className="flex flex-wrap gap-1.5">
                {guide.related.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    className="inline-flex items-center gap-0.5 rounded-md border bg-muted/50 px-2.5 py-1.5 text-xs font-medium hover:bg-accent transition-colors"
                  >
                    {link.label}
                    <ChevronRight size={12} className="opacity-60" />
                  </Link>
                ))}
              </div>
            </section>
          )}

          <section className="border-t pt-3 space-y-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-full gap-1.5 text-xs"
              onClick={() => {
                const ok = runProductTour(role);
                if (!ok) toast.message('Ouvrez le tableau de bord ou élargissez la fenêtre pour le tour.');
              }}
            >
              <Map size={14} />
              Tour interactif
            </Button>
            <Link
              href="/dashboard#getting-started"
              className="flex h-8 w-full items-center justify-center rounded-md text-xs font-medium hover:bg-accent"
            >
              Checklist Premiers pas
            </Link>
          </section>

          {index.length > 0 && (
            <section className="border-t pt-3">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                Autres écrans de votre profil
              </h3>
              <div className="grid gap-1">
                {index.map((entry) => (
                  <Link
                    key={entry.id}
                    href={entry.href}
                    className={cn(
                      'flex items-center justify-between rounded-md px-2.5 py-2 text-sm',
                      'hover:bg-accent transition-colors border border-transparent hover:border-border',
                    )}
                  >
                    <span className="font-medium">{entry.label}</span>
                    <ChevronRight size={14} className="text-muted-foreground shrink-0" />
                  </Link>
                ))}
              </div>
            </section>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
