import { JsonLd } from '@/components/seo/JsonLd';
import { MarketingPageShell, MarketingSection } from '@/components/marketing/MarketingPageShell';
import { LANDING_COLORS as C } from '@/components/marketing/landing-colors';
import { PRICING_PLANS, TRIAL_DAYS, formatXaf } from '@/lib/marketing/catalog';
import { breadcrumbJsonLd, softwareApplicationJsonLd } from '@/lib/seo/json-ld';
import { pageMetadata } from '@/lib/seo/metadata';

const PATH = '/tarifs';

const priceSummary = PRICING_PLANS.map((plan) => `${plan.name} ${formatXaf(plan.monthly)}`).join(', ');

export const metadata = pageMetadata({
  path: PATH,
  title: 'Tarifs logiciel garage en FCFA | Atelier Maître',
  description: `Forfaits Atelier Maître par mois : ${priceSummary}. Essai gratuit de ${TRIAL_DAYS} jours, sans installation.`,
});

export default function TarifsPage() {
  return (
    <MarketingPageShell
      eyebrow="Tarifs"
      title="Tarifs d'Atelier Maître, en FCFA"
      intro={`Trois forfaits mensuels, sans installation ni matériel. Le paiement annuel revient moins cher. Essai gratuit de ${TRIAL_DAYS} jours.`}
    >
      <JsonLd data={softwareApplicationJsonLd()} />
      <JsonLd data={breadcrumbJsonLd(PATH, 'Tarifs')} />
      <div className="grid gap-5 sm:grid-cols-3">
        {PRICING_PLANS.map((plan) => (
          <section
            key={plan.id}
            aria-labelledby={`plan-${plan.id}`}
            className="rounded-2xl border p-5"
            style={{ borderColor: plan.badge === 'Recommandé' ? C.brand : C.sand2, background: C.white }}
          >
            <h2 id={`plan-${plan.id}`} className="text-xl font-bold">
              {plan.name}
            </h2>
            {plan.badge ? (
              <p className="text-xs font-bold uppercase" style={{ color: C.brand }}>
                {plan.badge}
              </p>
            ) : null}
            <p className="mt-3 text-2xl font-black">{formatXaf(plan.monthly)}</p>
            <p className="text-sm" style={{ color: C.muted }}>
              par mois, ou {formatXaf(plan.annual)} par an
            </p>
            <p className="mt-3 text-sm" style={{ color: C.muted }}>
              {plan.description}
            </p>
            <ul className="mt-3 list-disc space-y-1 pl-5 text-sm" style={{ color: C.muted }}>
              {plan.features.map((feature) => (
                <li key={feature}>{feature}</li>
              ))}
            </ul>
          </section>
        ))}
      </div>
      <MarketingSection title="Ce qui est compris">
        <p>
          L&apos;application s&apos;utilise dans le navigateur et s&apos;installe sur téléphone : aucun serveur ni
          logiciel à installer au garage. Le support est en français.
        </p>
        <p>Plus de garages ou un besoin particulier ? Réservez une démo : le tarif est alors établi sur devis.</p>
      </MarketingSection>
    </MarketingPageShell>
  );
}
