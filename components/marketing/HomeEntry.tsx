'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/auth-context';
import { resolvePostLoginRoute } from '@/lib/role-routing';
import { Loader } from '@/components/ui/loader';
import { LandingPage } from '@/components/marketing/LandingPage';

/** `/` : landing publique ou redirection vers l'app si session active. */
export function HomeEntry() {
  const router = useRouter();
  const { isAuthenticated, isLoading, user } = useAuth();

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      router.replace(resolvePostLoginRoute(user));
    }
  }, [isLoading, isAuthenticated, user, router]);

  if (isLoading || isAuthenticated) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f4f7fb]">
        <Loader size="md" />
      </div>
    );
  }

  return <LandingPage />;
}
