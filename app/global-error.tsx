'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { ShieldAlert, RefreshCw } from 'lucide-react';

interface GlobalErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

/**
 * global-error.tsx — Capture les crashes totaux au niveau du root layout.
 * Ce composant remplace complètement le layout, il doit donc embarquer
 * <html> et <body> lui-même.
 */
export default function GlobalError({ error, reset }: GlobalErrorProps) {
  useEffect(() => {
    console.error('[GlobalError]', error);
  }, [error]);

  return (
    <html lang="fr">
      <body style={{ margin: 0, background: '#0D1B2E', color: '#e2e8f0', fontFamily: 'system-ui, sans-serif' }}>
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          gap: '24px',
          padding: '24px',
          textAlign: 'center',
        }}>
          <div style={{
            width: 72, height: 72,
            borderRadius: 16,
            background: 'rgba(239,68,68,0.1)',
            border: '1px solid rgba(239,68,68,0.25)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <ShieldAlert size={36} color="#ef4444" strokeWidth={1.5} />
          </div>

          <div>
            <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>
              Erreur critique de l&apos;application
            </h1>
            <p style={{ fontSize: 14, color: '#94a3b8', maxWidth: 360 }}>
              {error.message || 'L\'application a rencontré une erreur inattendue. Veuillez recharger la page.'}
            </p>
            {error.digest && (
              <p style={{ fontSize: 10, fontFamily: 'monospace', color: '#475569', marginTop: 8 }}>
                ref: {error.digest}
              </p>
            )}
          </div>

          <Button onClick={reset} className="gap-2" style={{ background: '#3B82F6' }}>
            <RefreshCw size={14} />
            Recharger l&apos;application
          </Button>
        </div>
      </body>
    </html>
  );
}
