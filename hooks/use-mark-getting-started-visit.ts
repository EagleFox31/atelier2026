'use client';

import { useEffect } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { markGettingStartedVisit } from '@/lib/getting-started-visits';

/** Marque une page comme « visitée » pour la checklist Premiers pas. */
export function useMarkGettingStartedVisit(page: string) {
  const { user } = useAuth();
  useEffect(() => {
    if (user?.id) markGettingStartedVisit(page, user.id);
  }, [user?.id, page]);
}
