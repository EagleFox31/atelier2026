'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/auth-context';
import { resolvePostLoginRoute } from '@/lib/role-routing';
import { LandingPage } from '@/components/marketing/LandingPage';

/**
 * `/` : la landing est toujours rendue (HTML serveur complet pour les robots et
 * les visiteurs sans JavaScript). La session vit dans localStorage, donc une
 * session active n'est connue qu'après hydratation : on redirige alors vers
 * l'application, sans jamais remplacer la landing par un écran de chargement.
 */
export function HomeEntry() {
  const router = useRouter();
  const { isAuthenticated, isLoading, user } = useAuth();

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      router.replace(resolvePostLoginRoute(user));
    }
  }, [isLoading, isAuthenticated, user, router]);

  return <LandingPage />;
}
