/**
 * E-mail de bienvenue après inscription — gabarit pur (aucun I/O), testable seul.
 *
 * Règle de sécurité : AUCUN mot de passe dans cet e-mail. Les mots de passe
 * temporaires sont affichés une seule fois à la fin de l'inscription ; une boîte
 * mail est consultée sur plusieurs appareils, transférée et conservée des années.
 */

export type WelcomeTeamMember = {
  roleCode: string;
  firstName: string;
  lastName: string;
  employeeCode: string;
};

export type WelcomeEmailInput = {
  adminFirstName: string;
  adminEmail: string;
  adminEmployeeCode: string | null;
  workshopName: string;
  trialEndsAt: Date;
  /** URL publique de l'app (https://…), sans slash final. null → e-mail sans lien ni image. */
  appUrl: string | null;
  team: WelcomeTeamMember[];
};

export type RenderedEmail = { subject: string; html: string; text: string };

const ROLE_LABELS: Record<string, string> = {
  CHEF_ATELIER: "Chef d'atelier",
  RECEPTIONNISTE: 'Réception',
  TECHNICIEN: 'Technicien',
  CAISSIER: 'Caisse',
};

const C = {
  brand: '#C8511A',
  brandDeep: '#8B3210',
  gold: '#D4A432',
  goldLight: '#F2C95A',
  earth: '#1A1209',
  green: '#1D6A4A',
  muted: '#6B5B4E',
  surface: '#FDFAF4',
  line: '#EDE0C4',
};

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function formatTrialEnd(date: Date): string {
  return date.toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'Africa/Douala',
  });
}

function roleLabel(code: string): string {
  return ROLE_LABELS[code] ?? code;
}

export function renderWelcomeEmail(input: WelcomeEmailInput): RenderedEmail {
  const e = escapeHtml;
  const trialEnd = formatTrialEnd(input.trialEndsAt);
  const loginUrl = input.appUrl ? `${input.appUrl}/login` : null;
  const teamUrl = input.appUrl ? `${input.appUrl}/team` : null;
  const subject = `Votre atelier ${input.workshopName} est prêt — Atelier Maître`;
  const preheader = `Votre pilote Pro gratuit a commencé. Il court jusqu'au ${trialEnd}.`;

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

  const button = loginUrl
    ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:28px 0 8px"><tr>
        <td style="border-radius:12px;background:${C.brand}">
          <a href="${e(loginUrl)}" style="display:inline-block;padding:14px 28px;font-family:Arial,Helvetica,sans-serif;font-size:16px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:12px">Ouvrir mon atelier</a>
        </td></tr></table>`
    : '';

  const teamRows = input.team
    .map(
      (m) => `<tr>
        <td style="padding:12px 14px;border-top:1px solid ${C.line};font-size:14px;color:${C.earth}">${e(m.firstName)} ${e(m.lastName)}</td>
        <td style="padding:12px 14px;border-top:1px solid ${C.line};font-size:14px;color:${C.muted}">${e(roleLabel(m.roleCode))}</td>
        <td style="padding:12px 14px;border-top:1px solid ${C.line};font-size:14px;font-family:Consolas,Menlo,monospace;color:${C.earth}">${e(m.employeeCode)}</td>
      </tr>`,
    )
    .join('');

  const teamBlock = input.team.length
    ? `<h2 style="margin:32px 0 6px;font-family:Arial,Helvetica,sans-serif;font-size:18px;color:${C.earth}">Votre équipe</h2>
       <p style="margin:0 0 14px;font-size:14px;line-height:1.6;color:${C.muted}">Chaque membre se connecte avec son identifiant. Les mots de passe temporaires vous ont été affichés à la fin de l'inscription${teamUrl ? `&nbsp;; vous pouvez en générer de nouveaux à tout moment depuis <a href="${e(teamUrl)}" style="color:${C.brand}">Équipe</a>` : ''}.</p>
       <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:separate;border:1px solid ${C.line};border-radius:12px;font-family:Arial,Helvetica,sans-serif">
         <tr style="background:${C.surface}">
           <th align="left" style="padding:10px 14px;font-size:12px;letter-spacing:.06em;text-transform:uppercase;color:${C.muted}">Membre</th>
           <th align="left" style="padding:10px 14px;font-size:12px;letter-spacing:.06em;text-transform:uppercase;color:${C.muted}">Rôle</th>
           <th align="left" style="padding:10px 14px;font-size:12px;letter-spacing:.06em;text-transform:uppercase;color:${C.muted}">Identifiant</th>
         </tr>${teamRows}
       </table>`
    : '';

  const html = `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title>${e(subject)}</title>
</head>
<body style="margin:0;padding:0;background:${C.surface}">
<div style="display:none;max-height:0;overflow:hidden;opacity:0">${e(preheader)}</div>
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
      <h1 style="margin:0 0 12px;font-family:Georgia,'Times New Roman',serif;font-size:28px;line-height:1.25;color:${C.earth}">Bienvenue, ${e(input.adminFirstName)}&nbsp;!</h1>
      <p style="margin:0;font-size:16px;line-height:1.65;color:${C.muted}">Votre espace <strong style="color:${C.earth}">${e(input.workshopName)}</strong> est prêt. Votre <strong style="color:${C.earth}">pilote Pro gratuit</strong> court jusqu'au <strong style="color:${C.earth}">${e(trialEnd)}</strong>, sans carte bancaire.</p>
      ${button}
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:20px;background:${C.surface};border:1px solid ${C.line};border-radius:12px">
        <tr><td style="padding:16px 18px;font-size:14px;line-height:1.7;color:${C.earth}">
          <strong>Vos accès administrateur</strong><br>
          E-mail&nbsp;: ${e(input.adminEmail)}<br>
          ${input.adminEmployeeCode ? `Identifiant&nbsp;: <span style="font-family:Consolas,Menlo,monospace">${e(input.adminEmployeeCode)}</span><br>` : ''}
          <span style="color:${C.muted}">Mot de passe&nbsp;: celui que vous avez choisi à l'inscription.</span>
        </td></tr>
      </table>
      ${teamBlock}
      <h2 style="margin:32px 0 10px;font-size:18px;color:${C.earth}">Pendant le pilote</h2>
      <ul style="margin:0;padding-left:20px;font-size:14px;line-height:1.8;color:${C.muted}">
        <li>Toutes les fonctionnalités de gestion Pro sont ouvertes.</li>
        <li>Les SMS Orange / MTN et le logo personnalisé s'activent avec un abonnement.</li>
        <li>Vos données restent conservées 90 jours après la fin du pilote.</li>
      </ul>
      <p style="margin:28px 0 0;font-size:14px;line-height:1.6;color:${C.muted}">Une question&nbsp;? <strong style="color:${C.earth}">Répondez simplement à cet e-mail</strong>, nous vous lisons.</p>
    </td></tr>
    <tr><td style="padding:18px 32px;background:${C.surface};border-top:1px solid ${C.line};font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.6;color:${C.muted}">
      Atelier Maître · logiciel de gestion de garage, Cameroun · un produit Trigenys<br>
      Vous recevez cet e-mail car vous venez de créer l'espace ${e(input.workshopName)}.
    </td></tr>
  </table>
</td></tr>
</table>
</body>
</html>`;

  const textTeam = input.team.length
    ? [
        '',
        'VOTRE ÉQUIPE',
        ...input.team.map((m) => `- ${m.firstName} ${m.lastName} (${roleLabel(m.roleCode)}) : identifiant ${m.employeeCode}`),
        `Les mots de passe temporaires vous ont été affichés à la fin de l'inscription${teamUrl ? ` ; vous pouvez en générer de nouveaux depuis ${teamUrl}` : ''}.`,
      ]
    : [];

  const text = [
    `Bienvenue, ${input.adminFirstName} !`,
    '',
    `Votre espace ${input.workshopName} est prêt. Votre pilote Pro gratuit court jusqu'au ${trialEnd}, sans carte bancaire.`,
    ...(loginUrl ? ['', `Ouvrir mon atelier : ${loginUrl}`] : []),
    '',
    'VOS ACCÈS ADMINISTRATEUR',
    `E-mail : ${input.adminEmail}`,
    ...(input.adminEmployeeCode ? [`Identifiant : ${input.adminEmployeeCode}`] : []),
    "Mot de passe : celui que vous avez choisi à l'inscription.",
    ...textTeam,
    '',
    'PENDANT LE PILOTE',
    '- Toutes les fonctionnalités de gestion Pro sont ouvertes.',
    "- Les SMS Orange / MTN et le logo personnalisé s'activent avec un abonnement.",
    '- Vos données restent conservées 90 jours après la fin du pilote.',
    '',
    'Une question ? Répondez simplement à cet e-mail.',
    '',
    '— Atelier Maître, un produit Trigenys',
  ].join('\n');

  return { subject, html, text };
}
