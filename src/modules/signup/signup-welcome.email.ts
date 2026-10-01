/**
 * E-mail de bienvenue après inscription — gabarit pur (aucun I/O), testable seul.
 *
 * Règle de sécurité : AUCUN mot de passe dans cet e-mail. Les mots de passe
 * temporaires sont affichés une seule fois à la fin de l'inscription ; une boîte
 * mail est consultée sur plusieurs appareils, transférée et conservée des années.
 */
import {
  EMAIL_COLORS as C,
  escapeHtml,
  formatDateDouala,
  renderBrandedEmailHtml,
  renderEmailButton,
  roleLabel,
  type RenderedEmail,
} from '../../shared/email/email-layout';

export { escapeHtml, type RenderedEmail };

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

export function formatTrialEnd(date: Date): string {
  return formatDateDouala(date);
}

export function renderWelcomeEmail(input: WelcomeEmailInput): RenderedEmail {
  const e = escapeHtml;
  const trialEnd = formatTrialEnd(input.trialEndsAt);
  const loginUrl = input.appUrl ? `${input.appUrl}/login` : null;
  const teamUrl = input.appUrl ? `${input.appUrl}/team` : null;
  const subject = `Votre atelier ${input.workshopName} est prêt — Atelier Maître`;
  const preheader = `Votre pilote Pro gratuit a commencé. Il court jusqu'au ${trialEnd}.`;

  const button = loginUrl ? renderEmailButton(loginUrl, 'Ouvrir mon atelier') : '';

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
       <p style="margin:0 0 14px;font-size:14px;line-height:1.6;color:${C.muted}">Les membres dotés d'une adresse e-mail reçoivent une invitation pour choisir eux-mêmes leur mot de passe. Pour les autres, les mots de passe temporaires vous ont été affichés à la fin de l'inscription${teamUrl ? `&nbsp;; vous pouvez en générer de nouveaux à tout moment depuis <a href="${e(teamUrl)}" style="color:${C.brand}">Équipe</a>` : ''}.</p>
       <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:separate;border:1px solid ${C.line};border-radius:12px;font-family:Arial,Helvetica,sans-serif">
         <tr style="background:${C.surface}">
           <th align="left" style="padding:10px 14px;font-size:12px;letter-spacing:.06em;text-transform:uppercase;color:${C.muted}">Membre</th>
           <th align="left" style="padding:10px 14px;font-size:12px;letter-spacing:.06em;text-transform:uppercase;color:${C.muted}">Rôle</th>
           <th align="left" style="padding:10px 14px;font-size:12px;letter-spacing:.06em;text-transform:uppercase;color:${C.muted}">Identifiant</th>
         </tr>${teamRows}
       </table>`
    : '';

  const bodyHtml = `<h1 style="margin:0 0 12px;font-family:Georgia,'Times New Roman',serif;font-size:28px;line-height:1.25;color:${C.earth}">Bienvenue, ${e(input.adminFirstName)}&nbsp;!</h1>
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
      <p style="margin:28px 0 0;font-size:14px;line-height:1.6;color:${C.muted}">Une question&nbsp;? <strong style="color:${C.earth}">Répondez simplement à cet e-mail</strong>, nous vous lisons.</p>`;

  const html = renderBrandedEmailHtml({
    subject,
    preheader,
    appUrl: input.appUrl,
    bodyHtml,
    footerHtml: `Atelier Maître · logiciel de gestion de garage, Cameroun · un produit Trigenys<br>
      Vous recevez cet e-mail car vous venez de créer l'espace ${e(input.workshopName)}.`,
  });

  const textTeam = input.team.length
    ? [
        '',
        'VOTRE ÉQUIPE',
        ...input.team.map((m) => `- ${m.firstName} ${m.lastName} (${roleLabel(m.roleCode)}) : identifiant ${m.employeeCode}`),
        "Les membres dotés d'une adresse e-mail reçoivent une invitation pour choisir eux-mêmes leur mot de passe.",
        `Pour les autres, les mots de passe temporaires vous ont été affichés à la fin de l'inscription${teamUrl ? ` ; vous pouvez en générer de nouveaux depuis ${teamUrl}` : ''}.`,
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
