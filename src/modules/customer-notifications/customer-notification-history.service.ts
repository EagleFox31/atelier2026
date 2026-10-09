import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { assertCustomerInGarage, requireGarageId } from '../../shared/garage/garage-scope';

const DEFAULT_LIMIT = 50;

/** Historique des notifications d'un client (lecture seule ; ni variables ni identifiant fournisseur). */
@Injectable()
export class CustomerNotificationHistoryService {
  constructor(private readonly prisma: PrismaService) {}

  async listForCustomer(customerId: string, garageId: string | null | undefined, limit = DEFAULT_LIMIT) {
    await assertCustomerInGarage(this.prisma, customerId, garageId);
    return this.prisma.customerNotification.findMany({
      where: { customerId, garageId: requireGarageId(garageId) },
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: {
        id: true,
        eventType: true,
        channel: true,
        status: true,
        skipReason: true,
        recipientE164: true,
        templateName: true,
        templateLanguage: true,
        lastErrorCode: true,
        serviceOrderId: true,
        appointmentId: true,
        quoteId: true,
        invoiceId: true,
        paymentId: true,
        createdAt: true,
        acceptedAt: true,
        sentAt: true,
        deliveredAt: true,
        readAt: true,
        failedAt: true,
      },
    });
  }
}
