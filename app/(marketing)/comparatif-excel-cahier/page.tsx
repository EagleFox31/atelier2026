import { JsonLd } from '@/components/seo/JsonLd';
import { MarketingPageShell, MarketingSection } from '@/components/marketing/MarketingPageShell';
import { LANDING_COLORS as C } from '@/components/marketing/landing-colors';
import { breadcrumbJsonLd } from '@/lib/seo/json-ld';
import { pageMetadata } from '@/lib/seo/metadata';

const PATH = '/comparatif-excel-cahier';

export const metadata = pageMetadata({
  path: PATH,
  title: 'Logiciel garage vs Excel ou cahier : comparatif | Atelier Maître',
  description:
    'Gérer un garage sur cahier, sur Excel ou avec Atelier Maître : comparatif point par point des OT, devis, factures XAF, stock, planning et suivi client.',
});

/** Comparaison qualitative : ce que permet chaque outil, sans chiffre inventé. */
const ROWS: ReadonlyArray<readonly [string, string, string, string]> = [
  ["Statut d'un véhicule", "Demander à l'atelier", "À jour si quelqu'un le remplit", "Visible par toute l'équipe, à chaque étape"],
  ['Devis et facture', 'Rédigés à la main', 'Devis et facture dans deux fichiers', "Facture générée depuis l'OT, en PDF"],
  ['TVA 19,25 % et timbre', 'Calcul manuel', 'Formules à maintenir', 'Calculés automatiquement en XAF'],
  ['Stock de pièces', 'Inventaire manuel', 'Mis à jour à la main', "Sortie de stock depuis l'OT, alertes de seuil"],
  ['Rendez-vous', 'Agenda papier', 'Tableau partagé', 'Planning et rappels clients'],
  ["Historique d'un véhicule", 'À retrouver dans les cahiers', 'Recherche dans plusieurs fichiers', 'Attaché au véhicule'],
  ['Plusieurs garages', 'Un cahier par site', 'Fichiers à consolider', 'Vue consolidée'],
  ['Accès sur téléphone', 'Non', 'Limité', 'Oui, application installable'],
  ['Droits par rôle', 'Non', 'Non', 'Oui (gérant, atelier, réception, caisse…)'],
];

export default function ComparatifPage() {
  return (
    <MarketingPageShell
      eyebrow="Comparatif"
      title="Atelier Maître face à Excel et au cahier d'atelier"
      intro="Le cahier et Excel ne coûtent rien au départ, et beaucoup de garages s'en servent bien. Voici ce qui change quand l'atelier passe sur un logiciel dédié."
    >
      <JsonLd data={breadcrumbJsonLd(PATH, 'Atelier Maître vs Excel ou cahier')} />
      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] border-collapse text-left text-sm">
          <caption className="sr-only">Comparatif cahier, Excel et Atelier Maître</caption>
          <thead>
            <tr style={{ background: C.sand }}>
              <th scope="col" className="p-3">Besoin</th>
              <th scope="col" className="p-3">Cahier</th>
              <th scope="col" className="p-3">Excel</th>
              <th scope="col" className="p-3">Atelier Maître</th>
            </tr>
          </thead>
          <tbody>
            {ROWS.map(([need, notebook, excel, app]) => (
              <tr key={need} className="border-b" style={{ borderColor: C.sand2 }}>
                <th scope="row" className="p-3 font-semibold">{need}</th>
                <td className="p-3" style={{ color: C.muted }}>{notebook}</td>
                <td className="p-3" style={{ color: C.muted }}>{excel}</td>
                <td className="p-3 font-medium">{app}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <MarketingSection title="Et vos données existantes ?">
        <p>Au démarrage, on vous aide à importer votre liste de clients et de véhicules : vous ne repartez pas de zéro.</p>
      </MarketingSection>
    </MarketingPageShell>
  );
}
