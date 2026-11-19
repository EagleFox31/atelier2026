import { CURRENCY, FAQ, FEATURE_LIST, PRICING_PLANS, type FaqItem } from '@/lib/marketing/catalog';
import { PUBLISHER, SITE_NAME, absoluteUrl } from '@/lib/seo/site';

/** Fiche SoftwareApplication d'Atelier Maître (schema.org). */
export function softwareApplicationJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    '@id': `${absoluteUrl('/')}#software`,
    name: SITE_NAME,
    url: absoluteUrl('/'),
    applicationCategory: 'BusinessApplication',
    applicationSubCategory: 'Logiciel de gestion de garage automobile',
    operatingSystem: 'Web',
    inLanguage: 'fr',
    areaServed: { '@type': 'Country', name: 'Cameroun' },
    description:
      'Logiciel de gestion de garage automobile au Cameroun : ordres de travail, devis et factures en XAF avec TVA 19,25 %, stock de pièces, planning atelier et notifications clients.',
    featureList: [...FEATURE_LIST],
    offers: PRICING_PLANS.map((plan) => ({
      '@type': 'Offer',
      name: plan.name,
      price: plan.monthly,
      priceCurrency: CURRENCY,
      url: absoluteUrl('/tarifs'),
      priceSpecification: {
        '@type': 'UnitPriceSpecification',
        price: plan.monthly,
        priceCurrency: CURRENCY,
        unitCode: 'MON',
        referenceQuantity: { '@type': 'QuantitativeValue', value: 1, unitCode: 'MON' },
      },
    })),
    publisher: { '@id': PUBLISHER.id },
  };
}

/** FAQPage schema.org à partir de questions réellement affichées sur la page. */
export function faqPageJsonLd(items: readonly FaqItem[] = FAQ) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: items.map((item) => ({
      '@type': 'Question',
      name: item.q,
      acceptedAnswer: { '@type': 'Answer', text: item.a },
    })),
  };
}

/** Fil d'Ariane schema.org pour une page publique de second niveau. */
export function breadcrumbJsonLd(path: string, label: string) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: SITE_NAME, item: absoluteUrl('/') },
      { '@type': 'ListItem', position: 2, name: label, item: absoluteUrl(path) },
    ],
  };
}
