import type { Metadata } from 'next';
import { HomeEntry } from '@/components/marketing/HomeEntry';

export const metadata: Metadata = {
  title: 'Atelier Maître — Logiciel garage Cameroun',
  description:
    "Gestion d'atelier automobile : OT, devis, factures XAF, stock, planning et SMS. Un compte, plusieurs garages.",
};

export default function HomePage() {
  return <HomeEntry />;
}
