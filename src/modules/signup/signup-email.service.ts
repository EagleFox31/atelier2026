import { Injectable, Logger } from '@nestjs/common';

type TeamCredential = {
  roleCode: string;
  firstName: string;
  lastName: string;
  employeeCode: string;
  tempPassword: string;
};

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

const ROLE_LABELS: Record<string, string> = {
  CHEF_ATELIER: "Chef d'atelier",
  RECEPTIONNISTE: 'Réception',
  TECHNICIEN: 'Technicien',
  CAISSIER: 'Caissier',
};

@Injectable()
export class SignupEmailService {
  private readonly logger = new Logger(SignupEmailService.name);

  async sendTeamCredentials(input: {
    to: string;
    adminName: string;
    workshopName: string;
    trialEndsAt: Date;
    team: TeamCredential[];
  }): Promise<boolean> {
    if (input.team.length === 0) return false;

    const apiKey = process.env.RESEND_API_KEY?.trim();
    const from = process.env.SIGNUP_EMAIL_FROM?.trim();
    if (!apiKey || !from) {
      this.logger.warn(
        'Récapitulatif inscription non envoyé : RESEND_API_KEY ou SIGNUP_EMAIL_FROM absent.',
      );
      return false;
    }

    const rows = input.team
      .map(
        (member) => `
          <tr>
            <td style="padding:12px;border-bottom:1px solid #eee">${escapeHtml(member.firstName)} ${escapeHtml(member.lastName)}</td>
            <td style="padding:12px;border-bottom:1px solid #eee">${escapeHtml(ROLE_LABELS[member.roleCode] ?? member.roleCode)}</td>
            <td style="padding:12px;border-bottom:1px solid #eee;font-family:monospace">${escapeHtml(member.employeeCode)}</td>
            <td style="padding:12px;border-bottom:1px solid #eee;font-family:monospace">${escapeHtml(member.tempPassword)}</td>
          </tr>`,
      )
      .join('');

    const trialDate = input.trialEndsAt.toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
      timeZone: 'Africa/Douala',
    });

    const html = `
      <div style="font-family:Arial,sans-serif;color:#2D1B09;line-height:1.5;max-width:760px;margin:auto">
        <div style="border-top:6px solid #C8511A;padding:28px 24px">
          <p style="margin:0 0 8px;color:#C8511A;font-size:12px;font-weight:700;letter-spacing:.12em;text-transform:uppercase">Atelier Maître</p>
          <h1 style="margin:0 0 12px;font-size:26px">Votre atelier est prêt</h1>
          <p style="margin:0;color:#66594d">
            Bonjour ${escapeHtml(input.adminName)}, votre espace <strong>${escapeHtml(input.workshopName)}</strong> est créé.
            Votre pilote Pro se termine le <strong>${escapeHtml(trialDate)}</strong>.
          </p>
        </div>
        <div style="padding:0 24px 24px">
          <h2 style="font-size:18px;margin:16px 0 10px">Identifiants de votre équipe</h2>
          <p style="font-size:13px;color:#66594d;margin:0 0 14px">
            Ces mots de passe sont temporaires. Transmettez-les uniquement aux personnes concernées.
          </p>
          <table style="width:100%;border-collapse:collapse;border:1px solid #eee;border-radius:12px;overflow:hidden">
            <thead style="background:#fff7f0;text-align:left">
              <tr>
                <th style="padding:12px">Membre</th>
                <th style="padding:12px">Rôle</th>
                <th style="padding:12px">Identifiant</th>
                <th style="padding:12px">Mot de passe temporaire</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
          <p style="margin:18px 0 0;font-size:12px;color:#7c6f64">
            Pour des raisons de sécurité, demandez à chaque membre de changer son mot de passe après sa première connexion.
          </p>
        </div>
      </div>
    `;

    try {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from,
          to: [input.to],
          subject: `Atelier Maître — identifiants de l'équipe ${input.workshopName}`,
          html,
        }),
      });

      if (!response.ok) {
        this.logger.warn(
          `Récapitulatif inscription non envoyé (Resend ${response.status})`,
        );
        return false;
      }

      return true;
    } catch (error) {
      this.logger.warn(
        `Récapitulatif inscription non envoyé : ${error instanceof Error ? error.message : String(error)}`,
      );
      return false;
    }
  }
}
