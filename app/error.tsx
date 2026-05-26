'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { AlertTriangle, RefreshCw, ArrowLeft } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface ErrorPageProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function Error({ error, reset }: ErrorPageProps) {
  const router = useRouter();

  useEffect(() => {
    // On pourrait logger vers Sentry ici dans le futur
    console.error('[AppError]', error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6 text-center px-4">
      <div className="w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center">
        <AlertTriangle size={32} className="text-red-500" strokeWidth={1.5} />
      </div>

      <div className="space-y-2 max-w-sm">
        <h1 className="text-xl font-bold text-foreground">Une erreur est survenue</h1>
        <p className="text-sm text-muted-foreground">
          {error.message || 'Une erreur inattendue s\'est produite sur cette page.'}
        </p>
        {error.digest && (
          <p className="text-[10px] font-mono text-muted-foreground/60 bg-muted px-2 py-1 rounded">
            ref: {error.digest}
          </p>
        )}
      </div>

      <div className="flex items-center gap-3">
        <Button
          variant="outline"
          size="sm"
          onClick={() => router.back()}
          className="gap-2"
        >
          <ArrowLeft size={14} />
          Retour
        </Button>
        <Button
          size="sm"
          onClick={reset}
          className="gap-2 bg-brand hover:bg-brand/90"
        >
          <RefreshCw size={14} />
          Réessayer
        </Button>
      </div>
    </div>
  );
}
