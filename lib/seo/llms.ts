import { CURRENCY, FAQ, FEATURE_LIST, PRICING_PLANS, TRIAL_DAYS, formatXaf } from '@/lib/marketing/catalog';
import { MARKETING_PAGES, PUBLISHER, SITE_NAME, SITE_URL, absoluteUrl } from '@/lib/seo/site';

/**
 * `/llms.txt` (format llmstxt.org) : résumé factuel du produit pour les
 * moteurs de réponse. Généré depuis le catalogue pour ne jamais diverger
 * des prix et de la FAQ affichés sur le site.
 */
export function buildLlmsTxt(): string {
  const plans = PRICING_PLANS.map(
    (plan) =>
      `- ${plan.name} : ${formatXaf(plan.monthly)} / mois ou ${formatXaf(plan.annual)} / an (${CURRENCY}) — ${plan.description} ${plan.features.join(', ')}.`,
  );
  const pages = MARKETING_PAGES.filter((page) => page.path !== '/').map(
    (page) => `- [${page.label}](${absoluteUrl(page.path)})`,
  );
  const faq = FAQ.map((item) => `- ${item.q} ${item.a}`);

  return [
    `# ${SITE_NAME}`,
    '',
    `> ${SITE_NAME} est un logiciel de gestion de garage automobile pour le Cameroun, en ligne (navigateur et téléphone) : ordres de travail, devis et factures en XAF avec TVA 19,25 %, stock de pièces, planning atelier et notifications clients. Édité par ${PUBLISHER.name} (${PUBLISHER.url}).`,
    '',
    '## Pour qui',
    '',
    '- Garages et ateliers de réparation automobile au Cameroun, indépendants ou multi-sites (Douala, Yaoundé, Bafoussam…).',
    '- Rôles couverts : gérant, chef d\'atelier, technicien, réceptionnaire, caissier, carrossier.',
    '',
    '## Fonctions',
    '',
    ...FEATURE_LIST.map((feature) => `- ${feature}`),
    '',
    '## Prix',
    '',
    ...plans,
    `- Essai gratuit de ${TRIAL_DAYS} jours, sans installation.`,
    '',
    '## Démo et contact',
    '',
    `- Réserver une démonstration : ${absoluteUrl('/demo')}`,
    `- Créer un compte : ${absoluteUrl('/inscription')}`,
    '',
    '## Pages',
    '',
    ...pages,
    '',
    '## Questions fréquentes',
    '',
    ...faq,
    '',
    '## Éditeur',
    '',
    `- ${PUBLISHER.name} — ${PUBLISHER.url}`,
    `- Site : ${SITE_URL}/`,
    '',
  ].join('\n');
}
