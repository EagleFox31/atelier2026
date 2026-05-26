'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/auth-context';
import { isTechnicianProfile } from '@/lib/role-routing';

/** Redirige les techniciens du tableau de bord vers leurs OT. */
export function TechnicianHomeRedirect() {
  const router = useRouter();
  const { user, isLoading } = useAuth();

  useEffect(() => {
    if (isLoading || !user) return;
    if (isTechnicianProfile(user)) {
      router.replace('/workshop');
    }
  }, [isLoading, user, router]);

  return null;
}
