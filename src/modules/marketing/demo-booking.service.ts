import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { DemoBookingDto } from './dto/demo-booking.dto';

@Injectable()
export class DemoBookingService {
  private readonly logger = new Logger(DemoBookingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  async submit(dto: DemoBookingDto): Promise<{ received: true }> {
    const recipientIds = await this.notifications.getUserIdsByRoles(['SUPER_ADMIN']);

    if (recipientIds.length === 0) {
      this.logger.error('Aucun utilisateur SUPER_ADMIN actif — demande démo non routée');
      throw new ServiceUnavailableException(
        'Impossible d\'enregistrer votre demande pour le moment. Réessayez plus tard.',
      );
    }

    const request = await this.prisma.demoRequest.create({
      data: {
        fullName: dto.fullName.trim(),
        email: dto.email.trim().toLowerCase(),
        phone: dto.phone.trim(),
        garageName: dto.garageName.trim(),
        city: dto.city?.trim() || null,
        message: dto.message?.trim() || null,
      },
    });

    const title = `Demande de démo — ${request.garageName}`;
    const bodyParts = [
      `${request.fullName} souhaite une démonstration.`,
      `Email : ${request.email}`,
      `Tél. : ${request.phone}`,
      request.city ? `Ville : ${request.city}` : null,
      request.message ? `Message : ${request.message}` : null,
    ].filter(Boolean);

    await this.notifications.createInApp({
      recipientIds,
      title,
      body: bodyParts.join('\n'),
      link: `/demo-requests?id=${request.id}`,
    });

    this.logger.log(
      `Demande démo #${request.id} — notifiée à ${recipientIds.length} super-admin(s)`,
    );

    return { received: true };
  }
}
