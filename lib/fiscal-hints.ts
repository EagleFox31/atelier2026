import {
  STAMP_DUTY_THRESHOLD_XAF,
  STAMP_DUTY_XAF,
  TVA_RATE,
} from '@/src/shared/fiscal/compute-amounts';

/** Libellé affiché (virgule décimale française) */
export const TVA_RATE_LABEL = `${(TVA_RATE * 100).toLocaleString('fr-FR', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})} %`;

function fmtXaf(n: number): string {
  return `${n.toLocaleString('fr-FR')} XAF`;
}

export type FiscalHintId = 'tva' | 'stamp' | 'taxRateSettings';

export const FISCAL_HINTS: Record<
  FiscalHintId,
  { title: string; body: string }
> = {
  tva: {
    title: 'TVA',
    body: `Taux camerounais en vigueur : ${TVA_RATE_LABEL}. Calculée sur le montant hors taxes (HT), arrondie à l'entier le plus proche. Au-delà de ${fmtXaf(STAMP_DUTY_THRESHOLD_XAF)} (HT + TVA), un timbre fiscal de ${fmtXaf(STAMP_DUTY_XAF)} s'ajoute au total TTC.`,
  },
  stamp: {
    title: 'Timbre fiscal',
    body: `Droit de timbre forfaitaire de ${fmtXaf(STAMP_DUTY_XAF)} appliqué lorsque le montant HT + TVA dépasse strictement ${fmtXaf(STAMP_DUTY_THRESHOLD_XAF)}.`,
  },
  taxRateSettings: {
    title: 'Taux de TVA',
    body: `Taux de référence de l'atelier pour vos documents. Les devis et factures calculent automatiquement la TVA à ${TVA_RATE_LABEL} sur le HT (arrondi à l'entier).`,
  },
};
