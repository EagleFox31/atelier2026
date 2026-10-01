'use client';

import { useEffect, useRef, useState } from 'react';
import { CheckCircle2, Wrench } from 'lucide-react';
import { SERVICE_STATUS_EVENT, type ServiceStatusDetail } from '@/lib/api';

type Status = 'ok' | 'unavailable' | 'restored';

/**
 * Bandeau affiché quand l'API répond « mise à jour en cours » (déploiement).
 * Piloté par lib/api.ts via l'événement SERVICE_STATUS_EVENT : aucun polling ici.
 * z-[130] : au-dessus de la BottomNav (100), des dialogs (105) et des popovers (120).
 */
export function ServiceStatusBanner() {
  const [status, setStatus] = useState<Status>('ok');
  const restoredTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    function onStatus(event: Event) {
      const { unavailable } = (event as CustomEvent<ServiceStatusDetail>).detail;
      if (restoredTimer.current) clearTimeout(restoredTimer.current);
      if (unavailable) {
        setStatus('unavailable');
        return;
      }
      setStatus('restored');
      restoredTimer.current = setTimeout(() => setStatus('ok'), 4000);
    }

    window.addEventListener(SERVICE_STATUS_EVENT, onStatus);
    return () => {
      window.removeEventListener(SERVICE_STATUS_EVENT, onStatus);
      if (restoredTimer.current) clearTimeout(restoredTimer.current);
    };
  }, []);

  if (status === 'ok') return null;

  const restored = status === 'restored';

  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 top-0 z-[130] flex justify-center px-4 pt-[max(0.75rem,env(safe-area-inset-top))]"
    >
      <div
        className={
          restored
            ? 'pointer-events-auto flex max-w-xl items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800 shadow-lg'
            : 'pointer-events-auto flex max-w-xl items-center gap-3 overflow-hidden rounded-2xl border border-[#C8511A]/30 bg-[#1A1209] px-4 py-3 text-sm text-[#F5EDD8] shadow-lg'
        }
      >
        {restored ? (
          <>
            <CheckCircle2 className="h-5 w-5 shrink-0" aria-hidden />
            <span>Connexion rétablie. Vous pouvez reprendre.</span>
          </>
        ) : (
          <>
            <span className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#C8511A]">
              <Wrench className="h-4 w-4 text-[#F2C95A] motion-safe:animate-pulse" aria-hidden />
            </span>
            <span className="leading-snug">
              <strong className="font-semibold text-white">Mise à jour en cours.</strong>{' '}
              Vos saisies sont conservées — reconnexion automatique dans un instant.
            </span>
          </>
        )}
      </div>
    </div>
  );
}
