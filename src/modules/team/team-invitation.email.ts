/**
 * E-mail d'invitation d'un employé — gabarit pur (aucun I/O), testable seul.
 *
 * Règle de sécurité : AUCUN mot de passe. Le lien contient un jeton à usage unique
 * (72 h) qui permet à l'employé de choisir lui-même son mot de passe.
 */
import {
  EMAIL_COLORS as C,
  escapeHtml,
  formatDateTimeDouala,
  renderBrandedEmailHtml,
  renderEmailButton,
  roleLabel,
  type RenderedEmail,
} from '../../shared/email/email-layout';

export type TeamInvitationEmailInput = {
  firstName: string;
  roleCode: string | null;
  employeeCode: string | null;
  email: string;
  workshopName: string;
  /** Prénom + nom de la personne qui invite (optionnel). */
  invitedByName?: string | null;
  expiresAt: Date;
  /** URL publique de l'app, sans slash final (obligatoire : un lien relatif est inutilisable dans un e-mail). */
  appUrl: string;
  /** Jeton brut (base64url) — uniquement dans le lien. */
  token: string;
};

export function invitationUrl(appUrl: string, token: string): string {
  return `${appUrl}/invitation/${encodeURIComponent(token)}`;
}

export function renderTeamInvitationEmail(input: TeamInvitationEmailInput): RenderedEmail {
  const e = escapeHtml;
  const link = invitationUrl(input.appUrl, input.token);
  const expires = formatDateTimeDouala(input.expiresAt);
  const role = input.roleCode ? roleLabel(input.roleCode) : null;
  const subject = `Invitation à rejoindre ${input.workshopName} sur Atelier Maître`;
  const preheader = `Activez votre compte avant le ${expires}.`;
  const inviter = input.invitedByName?.trim() || null;

  const intro = inviter
    ? `<strong style="color:${C.earth}">${e(inviter)}</strong> vous invite à rejoindre l'équipe de <strong style="color:${C.earth}">${e(input.workshopName)}</strong> sur Atelier Maître.`
    : `Vous êtes invité(e) à rejoindre l'équipe de <strong style="color:${C.earth}">${e(input.workshopName)}</strong> sur Atelier Maître.`;

  const bodyHtml = `<h1 style="margin:0 0 12px;font-family:Georgia,'Times New Roman',serif;font-size:28px;line-height:1.25;color:${C.earth}">Bonjour ${e(input.firstName)}&nbsp;!</h1>
      <p style="margin:0;font-size:16px;line-height:1.65;color:${C.muted}">${intro} Choisissez votre mot de passe pour activer votre compte.</p>
      ${renderEmailButton(link, 'Activer mon compte')}
      <p style="margin:0 0 4px;font-size:13px;line-height:1.6;color:${C.muted}">Ce lien est personnel et ne fonctionne qu'une fois. Il expire le <strong style="color:${C.earth}">${e(expires)}</strong> (heure de Douala).</p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:20px;background:${C.surface};border:1px solid ${C.line};border-radius:12px">
        <tr><td style="padding:16px 18px;font-size:14px;line-height:1.7;color:${C.earth}">
          <strong>Votre compte</strong><br>
          Atelier&nbsp;: ${e(input.workshopName)}<br>
          ${role ? `Rôle&nbsp;: ${e(role)}<br>` : ''}
          ${input.employeeCode ? `Identifiant&nbsp;: <span style="font-family:Consolas,Menlo,monospace">${e(input.employeeCode)}</span><br>` : ''}
          E-mail&nbsp;: ${e(input.email)}<br>
          <span style="color:${C.muted}">Vous vous connecterez ensuite avec votre e-mail ou votre identifiant.</span>
        </td></tr>
      </table>
      <p style="margin:24px 0 0;font-size:13px;line-height:1.6;color:${C.muted}">Le bouton ne s'ouvre pas&nbsp;? Copiez ce lien dans votre navigateur&nbsp;:<br><span style="word-break:break-all;color:${C.brand}">${e(link)}</span></p>
      <p style="margin:20px 0 0;font-size:13px;line-height:1.6;color:${C.muted}">Lien expiré ou invitation inattendue&nbsp;? Demandez à l'administrateur de votre atelier de vous renvoyer une invitation. Si vous ne connaissez pas cet atelier, ignorez cet e-mail.</p>`;

  const html = renderBrandedEmailHtml({
    subject,
    preheader,
    appUrl: input.appUrl,
    bodyHtml,
    footerHtml: `Atelier Maître · logiciel de gestion de garage, Cameroun · un produit Trigenys<br>
      Vous recevez cet e-mail car l'atelier ${e(input.workshopName)} vous a ajouté(e) à son équipe.`,
  });

  const text = [
    `Bonjour ${input.firstName} !`,
    '',
    inviter
      ? `${inviter} vous invite à rejoindre l'équipe de ${input.workshopName} sur Atelier Maître.`
      : `Vous êtes invité(e) à rejoindre l'équipe de ${input.workshopName} sur Atelier Maître.`,
    'Choisissez votre mot de passe pour activer votre compte :',
    '',
    `Activer mon compte : ${link}`,
    '',
    `Ce lien est personnel et ne fonctionne qu'une fois. Il expire le ${expires} (heure de Douala).`,
    '',
    'VOTRE COMPTE',
    `Atelier : ${input.workshopName}`,
    ...(role ? [`Rôle : ${role}`] : []),
    ...(input.employeeCode ? [`Identifiant : ${input.employeeCode}`] : []),
    `E-mail : ${input.email}`,
    'Vous vous connecterez ensuite avec votre e-mail ou votre identifiant.',
    '',
    "Lien expiré ou invitation inattendue ? Demandez à l'administrateur de votre atelier de vous renvoyer une invitation. Si vous ne connaissez pas cet atelier, ignorez cet e-mail.",
    '',
    '— Atelier Maître, un produit Trigenys',
  ].join('\n');

  return { subject, html, text };
}
