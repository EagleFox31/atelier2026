import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Créer mon atelier | Atelier Maître',
  description: 'Inscription en quelques minutes — administrateur, garage et équipe.',
};

export default function InscriptionLayout({ children }: { children: React.ReactNode }) {
  return children;
}
