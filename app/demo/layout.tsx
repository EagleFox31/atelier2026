import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Réserver une démo — Atelier Maître',
  description:
    'Demandez une démonstration guidée d\'Atelier Maître : gestion d\'atelier, OT, facturation XAF et stock.',
};

export default function DemoLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
