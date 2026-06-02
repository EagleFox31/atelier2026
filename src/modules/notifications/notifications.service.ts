import { Injectable, BadRequestException, NotFoundException, ForbiddenException, Optional } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { SendSmsDto } from './dto/notifications.dto';
import { resolveSmsMessage } from './sms-templates';
import { EventsService } from '../events/events.service';

@Injectable()
export class NotificationsService {
  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue('sms-notifications') private readonly smsQueue: Queue,
    @Optional() private readonly events?: EventsService,
  ) {}

  // ─── SMS ────────────────────────────────────────────────────────────────────

  getSmsHistory(phone?: string) {
    const where: Record<string, unknown> = {};
    if (phone) where.phoneTo = { contains: phone };

    return this.prisma.sMSNotification.findMany({
      where,
      orderBy: { sentAt: 'desc' },
      take: 50,
      include: {
        // Charge l'OT liée pour que le front puisse afficher `serviceOrder.reference`.
        serviceOrder: {
          select: { reference: true },
        },
      },
    });
  }

  async sendSms(data: SendSmsDto) {
    const lang = data.lang ?? 'fr';
    let message: string;
    try {
      message = resolveSmsMessage(data.templateCode, lang, data.message);
    } catch {
      throw new BadRequestException(`Modèle SMS inconnu : ${data.templateCode}`);
    }

    const notification = await this.prisma.sMSNotification.create({
      data: {
        phoneTo: data.phoneTo,
        templateCode: data.templateCode,
        messageBody: message,
        customerId: data.customerId,
        lang,
        status: 'PENDING',
      },
    });

    await this.smsQueue.add(data.templateCode, {
      phone: data.phoneTo,
      message,
      customerId: data.customerId,
      lang,
      notificationId: notification.id,
    });

    return notification;
  }

  // ─── In-App ──────────────────────────────────────────────────────────────────

  /**
   * Crée une notification in-app pour chaque destinataire.
   * recipientIds peut être un tableau (fan-out sur write).
   */
  async createInApp(data: {
    recipientIds: string[];
    title: string;
    body: string;
    link?: string;
    serviceOrderId?: string;
  }) {
    if (data.recipientIds.length === 0) return [];

    const created = await this.prisma.$transaction(
      data.recipientIds.map((recipientId) =>
        this.prisma.inAppNotification.create({
          data: {
            recipientId,
            title: data.title,
            body: data.body,
            link: data.link,
            serviceOrderId: data.serviceOrderId,
          },
        }),
      ),
    );

    this.events?.emitToUsers(data.recipientIds, {
      type: 'notification.new',
      title: data.title,
    });

    return created;
  }

  /** Notifications non-lues du destinataire (50 max, les plus récentes). */
  getInbox(userId: string) {
    return this.prisma.inAppNotification.findMany({
      where: { recipientId: userId, isRead: false },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  /** Nombre de notifications non-lues pour le badge. */
  getUnreadCount(userId: string) {
    return this.prisma.inAppNotification.count({
      where: { recipientId: userId, isRead: false },
    });
  }

  /** Marque une notification comme lue — refuse si elle n'appartient pas à l'utilisateur. */
  async markRead(notifId: string, userId: string) {
    const notif = await this.prisma.inAppNotification.findUnique({
      where: { id: notifId },
    });

    if (!notif) throw new NotFoundException('Notification introuvable');
    if (notif.recipientId !== userId) throw new ForbiddenException('Accès refusé');

    return this.prisma.inAppNotification.update({
      where: { id: notifId },
      data: { isRead: true, readAt: new Date() },
    });
  }

  /** Marque toutes les notifications d'un utilisateur comme lues. */
  markAllRead(userId: string) {
    return this.prisma.inAppNotification.updateMany({
      where: { recipientId: userId, isRead: false },
      data: { isRead: true, readAt: new Date() },
    });
  }

  /**
   * Retourne les IDs uniques des utilisateurs actifs ayant au moins un des rôles listés.
   * Pour cibler réception ET caissier, appeler deux fois ou fusionner les tableaux côté appelant.
   */
  async getUserIdsByRoles(roleCodes: string[]): Promise<string[]> {
    const userRoles = await this.prisma.userRole.findMany({
      where: {
        revokedAt: null,
        role: { code: { in: roleCodes } },
        user: { deletedAt: null },
      },
      select: { userId: true },
      distinct: ['userId'],
    });
    return userRoles.map((ur) => ur.userId);
  }
}

/** Rôles alertés lors de la création d'un OT. */
export const OT_CREATED_NOTIFY_ROLES = ['CHEF_ATELIER', 'ADMIN', 'SUPER_ADMIN'] as const;
