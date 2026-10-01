/**
 * Habillage commun des e-mails Atelier Maître (bandeau kente, logo, couleurs terre cuite).
 * Fonctions pures (aucun I/O), partagées par l'e-mail de bienvenue et l'invitation d'équipe.
 */

export type RenderedEmail = { subject: string; html: string; text: string };

export const EMAIL_COLORS = {
  brand: '#C8511A',
  brandDeep: '#8B3210',
  gold: '#D4A432',
  goldLight: '#F2C95A',
  earth: '#1A1209',
  green: '#1D6A4A',
  muted: '#6B5B4E',
  surface: '#FDFAF4',
  line: '#EDE0C4',
} as const;

const C = EMAIL_COLORS;

const ROLE_LABELS: Record<string, string> = {
  ADMIN: 'Administrateur',
  CHEF_ATELIER: "Chef d'atelier",
  RECEPTIONNISTE: 'Réception',
  TECHNICIEN: 'Technicien',
  CAISSIER: 'Caisse',
};

export function roleLabel(code: string): string {
  return ROLE_LABELS[code] ?? code;
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/** Date longue en français, fuseau du Cameroun (ex. « 1 novembre 2026 »). */
export function formatDateDouala(date: Date): string {
  return date.toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'Africa/Douala',
  });
}

/** Date + heure en français, fuseau du Cameroun (ex. « 4 octobre 2026 à 10:00 »). */
export function formatDateTimeDouala(date: Date): string {
  const day = formatDateDouala(date);
  const time = date.toLocaleTimeString('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Africa/Douala',
  });
  return `${day} à ${time}`;
}

/** Bouton d'action principal (table HTML, compatible clients mail). */
export function renderEmailButton(url: string, label: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:28px 0 8px"><tr>
        <td style="border-radius:12px;background:${C.brand}">
          <a href="${escapeHtml(url)}" style="display:inline-block;padding:14px 28px;font-family:Arial,Helvetica,sans-serif;font-size:16px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:12px">${escapeHtml(label)}</a>
        </td></tr></table>`;
}

/**
 * Document HTML complet : en-tête (kente + logo), contenu, pied de page.
 * `bodyHtml` et `footerHtml` sont insérés tels quels : l'appelant échappe ses données.
 */
export function renderBrandedEmailHtml(input: {
  subject: string;
  preheader: string;
  appUrl: string | null;
  bodyHtml: string;
  footerHtml: string;
}): string {
  const e = escapeHtml;

  const kente = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse"><tr>
    <td height="6" style="background:${C.brand};font-size:0;line-height:0">&nbsp;</td>
    <td height="6" style="background:${C.gold};font-size:0;line-height:0">&nbsp;</td>
    <td height="6" style="background:${C.green};font-size:0;line-height:0">&nbsp;</td>
    <td height="6" style="background:${C.brandDeep};font-size:0;line-height:0">&nbsp;</td>
    <td height="6" style="background:${C.goldLight};font-size:0;line-height:0">&nbsp;</td>
  </tr></table>`;

  const logo = input.appUrl
    ? `<img src="${e(input.appUrl)}/icon" width="44" height="44" alt="Atelier Maître" style="display:block;border:0;border-radius:11px">`
    : '';

  return `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title>${e(input.subject)}</title>
</head>
<body style="margin:0;padding:0;background:${C.surface}">
<div style="display:none;max-height:0;overflow:hidden;opacity:0">${e(input.preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.surface}">
<tr><td align="center" style="padding:32px 12px">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border:1px solid ${C.line};border-radius:18px;overflow:hidden">
    <tr><td>${kente}</td></tr>
    <tr><td style="padding:32px 32px 8px">
      <table role="presentation" cellpadding="0" cellspacing="0"><tr>
        ${logo ? `<td style="padding-right:12px">${logo}</td>` : ''}
        <td style="font-family:Arial,Helvetica,sans-serif;font-size:18px;font-weight:700;color:${C.earth}">Atelier <span style="color:${C.brand}">Maître</span></td>
      </tr></table>
    </td></tr>
    <tr><td style="padding:16px 32px 32px;font-family:Arial,Helvetica,sans-serif">
      ${input.bodyHtml}
    </td></tr>
    <tr><td style="padding:18px 32px;background:${C.surface};border-top:1px solid ${C.line};font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.6;color:${C.muted}">
      ${input.footerHtml}
    </td></tr>
  </table>
</td></tr>
</table>
</body>
</html>`;
}
