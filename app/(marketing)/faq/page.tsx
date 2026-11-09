import { JsonLd } from '@/components/seo/JsonLd';
import { MarketingPageShell, MarketingSection } from '@/components/marketing/MarketingPageShell';
import { FAQ } from '@/lib/marketing/catalog';
import { breadcrumbJsonLd, faqPageJsonLd } from '@/lib/seo/json-ld';
import { pageMetadata } from '@/lib/seo/metadata';

const PATH = '/faq';

export const metadata = pageMetadata({
  path: PATH,
  title: 'Questions fréquentes sur le logiciel garage | Atelier Maître',
  description:
    "Prix, installation sur téléphone, multi-garages, factures en XAF, import de vos clients : les réponses aux questions posées avant une démo d'Atelier Maître.",
});

export default function FaqPage() {
  return (
    <MarketingPageShell
      eyebrow="FAQ"
      title="Questions fréquentes sur Atelier Maître"
      intro="Les questions que les garagistes posent le plus souvent avant de démarrer."
    >
      <JsonLd data={faqPageJsonLd(FAQ)} />
      <JsonLd data={breadcrumbJsonLd(PATH, 'Questions fréquentes')} />
      {FAQ.map((item) => (
        <MarketingSection key={item.q} title={item.q}>
          <p>{item.a}</p>
        </MarketingSection>
      ))}
    </MarketingPageShell>
  );
}
