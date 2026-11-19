import { HomeEntry } from '@/components/marketing/HomeEntry';
import { JsonLd } from '@/components/seo/JsonLd';
import { softwareApplicationJsonLd } from '@/lib/seo/json-ld';
import { pageMetadata } from '@/lib/seo/metadata';

export const metadata = pageMetadata({
  path: '/',
  title: 'Atelier Maître — Logiciel garage Cameroun',
  description:
    "Gestion d'atelier automobile : OT, devis, factures XAF, stock, planning et SMS. Un compte, plusieurs garages.",
});

export default function HomePage() {
  return (
    <>
      <JsonLd data={softwareApplicationJsonLd()} />
      <HomeEntry />
    </>
  );
}
