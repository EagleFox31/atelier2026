/** TVA camerounaise — 19,25 % */
export const TVA_RATE = 0.1925;

/** Timbre fiscal si HT + TVA > 20 000 XAF */
export const STAMP_DUTY_XAF = 1000;
export const STAMP_DUTY_THRESHOLD_XAF = 20000;

export interface FiscalAmounts {
  subtotal: number;
  taxRate: number;
  taxAmount: number;
  stampDuty: number;
  total: number;
}

/**
 * Calcul fiscal centralisé (facturation OT, VCC, devis).
 * TVA arrondie à l'entier ; timbre 1000 XAF si subtotal + TVA > 20 000 XAF.
 */
export function computeAmounts(subtotal: number): FiscalAmounts {
  const taxAmount = Math.round(subtotal * TVA_RATE);
  const stampDuty = subtotal + taxAmount > STAMP_DUTY_THRESHOLD_XAF ? STAMP_DUTY_XAF : 0;
  const total = subtotal + taxAmount + stampDuty;

  return {
    subtotal,
    taxRate: TVA_RATE,
    taxAmount,
    stampDuty,
    total,
  };
}

/** Total d'une ligne VCC / devis avec remise en pourcentage */
export function computeLineTotal(
  quantity: number,
  unitPriceXaf: number,
  discountPct = 0,
): number {
  return Math.round(quantity * unitPriceXaf * (1 - discountPct / 100));
}
