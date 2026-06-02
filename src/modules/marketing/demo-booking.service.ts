import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import { DemoBookingDto } from './dto/demo-booking.dto';

const DEFAULT_INBOX = 'lawrynnjennifer@gmail.com';

@Injectable()
export class DemoBookingService {
  private readonly logger = new Logger(DemoBookingService.name);
  private transporter: Transporter | null = null;

  private getTransporter(): Transporter | null {
    if (this.transporter) return this.transporter;

    const host = process.env.SMTP_HOST?.trim();
    const user = process.env.SMTP_USER?.trim();
    const pass = process.env.SMTP_PASS?.trim();
    if (!host || !user || !pass) return null;

    const port = parseInt(process.env.SMTP_PORT || '587', 10);
    const secure = process.env.SMTP_SECURE === 'true';

    this.transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: { user, pass },
    });
    return this.transporter;
  }

  async submit(dto: DemoBookingDto): Promise<{ received: true }> {
    const to = process.env.DEMO_REQUEST_TO?.trim() || DEFAULT_INBOX;
    const from =
      process.env.SMTP_FROM?.trim() ||
      `"Atelier Maître" <${process.env.SMTP_USER?.trim() || 'noreply@atelier-maitre.cm'}>`;

    const transporter = this.getTransporter();
    if (!transporter) {
      this.logger.error(
        'SMTP non configuré (SMTP_HOST, SMTP_USER, SMTP_PASS) — demande démo non envoyée',
      );
      throw new ServiceUnavailableException(
        'Envoi temporairement indisponible. Réessayez plus tard ou écrivez-nous à contact@atelier2026.cm',
      );
    }

    const lines = [
      `Nom : ${dto.fullName}`,
      `Email : ${dto.email}`,
      `Téléphone : ${dto.phone}`,
      `Atelier : ${dto.garageName}`,
      dto.city ? `Ville : ${dto.city}` : null,
      dto.message ? `\nMessage :\n${dto.message}` : null,
      `\n— Envoyé depuis le formulaire démo Atelier Maître (${new Date().toISOString()})`,
    ].filter(Boolean);

    const subject = `[Démo] ${dto.garageName} — ${dto.fullName}`;

    try {
      await transporter.sendMail({
        from,
        to,
        replyTo: dto.email,
        subject,
        text: lines.join('\n'),
        html: lines.map((l) => `<p>${l?.replace(/\n/g, '<br>')}</p>`).join(''),
      });
      this.logger.log(`Demande démo envoyée à ${to} (${dto.email})`);
    } catch (err) {
      this.logger.error('Échec envoi email démo', err);
      throw new ServiceUnavailableException(
        'Impossible d\'enregistrer votre demande pour le moment. Réessayez dans quelques minutes.',
      );
    }

    return { received: true };
  }
}
