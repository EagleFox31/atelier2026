import { pageMetadata } from '@/lib/seo/metadata';

export const metadata = pageMetadata({
  path: '/demo',
  title: 'Réserver une démo — Atelier Maître',
  description:
    "Demandez une démonstration guidée d'Atelier Maître : gestion d'atelier, OT, facturation XAF et stock.",
});

export default function DemoLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
