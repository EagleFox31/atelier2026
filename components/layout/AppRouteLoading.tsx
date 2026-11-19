import { PageSkeleton } from '@/components/ui/page-skeleton';

/**
 * Squelette de navigation des routes applicatives et des formulaires de compte.
 * Volontairement absent des pages publiques : un `loading.tsx` à la racine de
 * `app/` envelopperait aussi la landing dans un Suspense, et React sortirait
 * alors son contenu (gros) dans un bloc caché, servi aux robots derrière ce squelette.
 */
export function AppRouteLoading() {
  return <PageSkeleton />;
}
