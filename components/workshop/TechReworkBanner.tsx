'use client';

import { Button } from '@/components/ui/button';
import { AlertTriangle, Loader2, Wrench } from 'lucide-react';

interface TechReworkBannerProps {
  rejectionReason?: string | null;
  onResume: () => void;
  loading?: boolean;
}

export function TechReworkBanner({
  rejectionReason,
  onResume,
  loading = false,
}: TechReworkBannerProps) {
  return (
    <div className="rounded-2xl border border-orange-200 bg-orange-50/80 dark:bg-orange-950/20 p-4 md:p-5 flex flex-col sm:flex-row sm:items-center gap-4">
      <div className="flex-1 min-w-0">
        <p className="font-bold text-foreground flex items-center gap-2">
          <AlertTriangle size={18} className="text-orange-500 shrink-0" />
          Contrôle qualité refusé
        </p>
        <p className="text-sm text-muted-foreground mt-1">
          {rejectionReason
            ? <>Motif du chef : <span className="italic text-foreground/80">&laquo;&nbsp;{rejectionReason}&nbsp;&raquo;</span></>
            : 'Le chef a demandé des corrections. Reprenez les travaux puis resoumettez au contrôle qualité.'}
        </p>
      </div>
      <Button
        className="bg-brand hover:bg-brand-hover font-bold gap-2 shrink-0 w-full sm:w-auto hidden md:inline-flex"
        onClick={onResume}
        disabled={loading}
      >
        {loading ? <Loader2 size={18} className="animate-spin" /> : <Wrench size={18} />}
        Reprendre les travaux
      </Button>
    </div>
  );
}
