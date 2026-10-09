import { Injectable } from '@nestjs/common';
import type { CustomerNotification } from '@prisma/client';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { epochSeconds, scheduledEpochFromKey } from './notification-keys';

type StalenessTarget = Pick<
  CustomerNotification,
  'garageId' | 'eventType' | 'idempotencyKey' | 'appointmentId' | 'serviceOrderId' | 'quoteId' | 'invoiceId' | 'paymentId'
>;

const APPOINTMENT_CLOSED = new Set(['CANCELLED', 'NO_SHOW', 'COMPLETED']);
const ORDER_CLOSED = new Set(['CANCELLED', 'CLOSED']);
const INVOICE_SETTLED = new Set(['PAID', 'CANCELLED']);

/**
 * Relit l'état réel de l'objet métier juste avant l'envoi : un message dont
 * l'objet a changé depuis l'émission (RDV annulé ou déplacé, facture soldée,
 * devis révisé…) est périmé et n'est pas envoyé. Objet introuvable = périmé.
 */
@Injectable()
export class NotificationStalenessService {
  constructor(private readonly prisma: PrismaService) {}

  async isStale(target: StalenessTarget, now: Date): Promise<boolean> {
    const garageId = target.garageId;
    switch (target.eventType) {
      case 'APPOINTMENT_CONFIRMED':
      case 'APPOINTMENT_REMINDER': {
        if (!target.appointmentId) return true;
        const appointment = await this.prisma.appointment.findFirst({
          where: { id: target.appointmentId, garageId },
          select: { status: true, scheduledAt: true },
        });
        if (!appointment || APPOINTMENT_CLOSED.has(appointment.status)) return true;
        if (appointment.scheduledAt.getTime() <= now.getTime()) return true;
        return scheduledEpochFromKey(target.idempotencyKey) !== epochSeconds(appointment.scheduledAt);
      }
      case 'SERVICE_ORDER_RECEIVED':
      case 'VEHICLE_READY': {
        if (!target.serviceOrderId) return true;
        const order = await this.prisma.serviceOrder.findFirst({
          where: { id: target.serviceOrderId, garageId },
          select: { status: true },
        });
        if (!order || ORDER_CLOSED.has(order.status)) return true;
        return target.eventType === 'VEHICLE_READY' && order.status !== 'READY' && order.status !== 'INVOICED';
      }
      case 'QUOTE_APPROVAL_REQUESTED': {
        if (!target.quoteId) return true;
        const quote = await this.prisma.quote.findFirst({
          where: { id: target.quoteId, garageId },
          select: { status: true },
        });
        // Un devis révisé passe en REVISED : seule la révision encore SENT est à valider.
        return !quote || quote.status !== 'SENT';
      }
      case 'INVOICE_AVAILABLE':
      case 'INVOICE_PAYMENT_REMINDER': {
        if (!target.invoiceId) return true;
        const invoice = await this.prisma.invoice.findFirst({
          where: { id: target.invoiceId, garageId },
          select: { status: true, balanceXaf: true },
        });
        if (!invoice || invoice.status === 'DRAFT' || invoice.status === 'CANCELLED') return true;
        return (
          target.eventType === 'INVOICE_PAYMENT_REMINDER' &&
          (INVOICE_SETTLED.has(invoice.status) || Number(invoice.balanceXaf) <= 0)
        );
      }
      case 'PAYMENT_CONFIRMED': {
        if (!target.paymentId) return true;
        const payment = await this.prisma.payment.findFirst({
          where: { id: target.paymentId, garageId },
          select: { status: true },
        });
        return !payment || payment.status !== 'CONFIRMED';
      }
    }
  }
}
