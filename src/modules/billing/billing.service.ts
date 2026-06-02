
import { Injectable, BadRequestException, Logger, NotFoundException } from '@nestjs/common';
import { PaymentMethod, OTStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { WorkshopService } from '../workshop/workshop.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PartsFlowService } from '../stock/parts-flow.service';
import { computeAmounts } from '../../shared/fiscal/compute-amounts';
import {
  QUOTE_CLIENT_APPROVAL_METHODS,
  QUOTE_DEFAULT_APPROVAL_METHOD,
  type QuoteClientApprovalMethod,
} from '../../shared/billing/quote-approval.constants';
import { CreateQuoteDto } from './dto/billing.dto';

@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name);

  constructor(
    private prisma: PrismaService,
    private workshopService: WorkshopService,
    private notifications: NotificationsService,
    private partsFlow: PartsFlowService,
  ) {}

  /**
   * Calcul fiscal centralisé (Point 9) — délègue au helper partagé.
   */
  computeAmounts(subtotal: number) {
    return computeAmounts(subtotal);
  }

  listQuotes(serviceOrderId?: string, garageId?: string | null) {
    const where: Record<string, unknown> = { ...(garageId ? { garageId } : {}) };
    if (serviceOrderId) where.serviceOrderId = serviceOrderId;
    return this.prisma.quote.findMany({
      where,
      include: {
        customer: true,
        lines: true,
        serviceOrder: { select: { reference: true } },
        creator: { select: { firstName: true, lastName: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  createQuote(body: CreateQuoteDto, userId: string, garageId?: string | null) {
    const amounts = this.computeAmounts(body.subtotal);

    return this.prisma.quote.create({
      data: {
        ...(garageId ? { garageId } : {}),
        serviceOrderId: body.serviceOrderId,
        customerId: body.customerId,
        createdBy: userId,
        subtotalXaf: amounts.subtotal,
        taxRate: amounts.taxRate,
        taxAmountXaf: amounts.taxAmount,
        stampDutyXaf: amounts.stampDuty,
        totalXaf: amounts.total,
        status: 'DRAFT',
        notes: body.notes,
        validUntil: body.validUntil ? new Date(body.validUntil) : undefined,
        lines: {
          create: body.lines.map((line, i) => ({
            lineType: line.lineType,
            description: line.description,
            laborCatalogId: line.laborCatalogId,
            partId: line.partId,
            quantity: line.quantity,
            unitPriceXaf: line.unitPriceXaf,
            discountPct: line.discountPct ?? 0,
            observationId: line.observationId,
            sortOrder: i,
          })),
        },
      },
      include: { lines: true },
    });
  }

  async sendQuote(quoteId: string) {
    const quote = await this.prisma.quote.findUnique({
      where: { id: quoteId },
      select: {
        id: true,
        status: true,
        reference: true,
        serviceOrderId: true,
        serviceOrder: { select: { reference: true } },
        customer: { select: { firstName: true, lastName: true, companyName: true, customerType: true } },
      },
    });
    if (!quote) throw new NotFoundException('Devis introuvable');
    if (quote.status !== 'DRAFT')
      throw new BadRequestException('Seul un devis en brouillon peut être soumis au client');

    await this.prisma.quote.update({ where: { id: quoteId }, data: { status: 'SENT' } });

    if (quote.serviceOrderId) {
      await this.prisma.serviceOrder.updateMany({
        where: { id: quote.serviceOrderId, status: OTStatus.DIAGNOSING },
        data: { status: OTStatus.QUOTE_PENDING },
      });
    }

    // Notif interne — réceptionniste + chef + admin doivent appeler le client
    try {
      const clientName = quote.customer?.customerType === 'COMPANY'
        ? (quote.customer.companyName ?? 'Client')
        : [quote.customer?.firstName, quote.customer?.lastName].filter(Boolean).join(' ') || 'Client';

      const otRef = quote.serviceOrder?.reference ?? '';
      const recipientIds = await this.notifications.getUserIdsByRoles([
        'RECEPTIONNISTE', 'CHEF_ATELIER', 'ADMIN', 'SUPER_ADMIN',
      ]);
      await this.notifications.createInApp({
        recipientIds,
        title: `Devis à valider — ${clientName}`,
        body: `${quote.reference}${otRef ? ` (OT ${otRef})` : ''} est en attente de validation client. À contacter.`,
        link: `/billing/quotes/${quoteId}`,
        serviceOrderId: quote.serviceOrderId ?? undefined,
      });
    } catch (err) {
      this.logger.warn(`Échec notification devis soumis ${quoteId}: ${(err as Error).message}`);
    }

    return { success: true };
  }

  async approveQuote(
    quoteId: string,
    body: { clientApprovalMethod?: string; clientSignatureRef?: string },
    userId: string,
  ) {
    const rawMethod = body.clientApprovalMethod ?? QUOTE_DEFAULT_APPROVAL_METHOD;
    if (!QUOTE_CLIENT_APPROVAL_METHODS.includes(rawMethod as QuoteClientApprovalMethod)) {
      throw new BadRequestException(
        `Méthode d'approbation invalide. Valeurs autorisées : ${QUOTE_CLIENT_APPROVAL_METHODS.join(', ')}`,
      );
    }

    const quote = await this.prisma.quote.update({
      where: { id: quoteId },
      data: {
        status: 'APPROVED',
        approvedByClientAt: new Date(),
        clientApprovalMethod: rawMethod,
        clientSignatureRef: body.clientSignatureRef,
      },
      include: {
        serviceOrder: { select: { id: true, reference: true, assignedChef: true } },
        customer: { select: { firstName: true, lastName: true, companyName: true, customerType: true } },
      },
    });

    // Transition OT QUOTE_PENDING → QUOTE_APPROVED
    if (quote.serviceOrderId) {
      await this.prisma.serviceOrder.updateMany({
        where: { id: quote.serviceOrderId, status: 'QUOTE_PENDING' },
        data: { status: 'QUOTE_APPROVED' },
      });
    }

    // Notif interne — assigné + chefs + admin : les travaux peuvent démarrer
    try {
      const clientName = quote.customer?.customerType === 'COMPANY'
        ? (quote.customer.companyName ?? 'Client')
        : [quote.customer?.firstName, quote.customer?.lastName].filter(Boolean).join(' ') || 'Client';

      const otRef = quote.serviceOrder?.reference ?? '';
      const otId  = quote.serviceOrder?.id ?? quote.serviceOrderId;

      const byRoleIds = await this.notifications.getUserIdsByRoles([
        'CHEF_ATELIER', 'ADMIN', 'SUPER_ADMIN',
      ]);
      const assignedChefId = quote.serviceOrder?.assignedChef;
      const recipientIds = [
        ...byRoleIds,
        ...(assignedChefId ? [assignedChefId] : []),
      ].filter((id, i, arr) => arr.indexOf(id) === i);

      await this.notifications.createInApp({
        recipientIds,
        title: `Devis approuvé — démarrer les travaux`,
        body: `${clientName} a validé ${quote.reference}${otRef ? ` (OT ${otRef})` : ''}. Vous pouvez lancer les travaux.`,
        link: `/workshop/${otId}`,
        serviceOrderId: quote.serviceOrderId ?? undefined,
      });
    } catch (err) {
      this.logger.warn(`Échec notification approbation devis ${quoteId}: ${(err as Error).message}`);
    }

    if (quote.serviceOrderId) {
      try {
        await this.partsFlow.onQuoteApproved({
          quoteId,
          serviceOrderId: quote.serviceOrderId,
          userId,
          otReference: quote.serviceOrder?.reference,
        });
      } catch (err) {
        this.logger.error(`Échec réservation pièces devis ${quoteId}`, err);
      }
    }

    return quote;
  }

  listInvoices(customerId?: string, status?: string, garageId?: string | null) {
    const where: Record<string, unknown> = { ...(garageId ? { garageId } : {}) };
    if (customerId) where.customerId = customerId;
    if (status) where.status = status;

    return this.prisma.invoice.findMany({
      where,
      include: {
        customer: true,
        lines: true,
        payments: true,
        serviceOrder: { select: { reference: true } },
        creator: { select: { firstName: true, lastName: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  getQuote(id: string) {
    return this.prisma.quote.findUnique({
      where: { id },
      include: {
        customer: true,
        lines: { include: { part: true, laborCatalog: true } },
        serviceOrder: {
          select: {
            reference: true,
            mileageIn: true,
            clientComplaint: true,
            vehicle: {
              select: {
                plateNumber: true,
                vin: true,
                make: { select: { name: true } },
                model: { select: { name: true } },
              },
            },
          },
        },
        creator: { select: { firstName: true, lastName: true } },
      },
    });
  }

  getInvoice(id: string) {
    return this.prisma.invoice.findUnique({
      where: { id },
      include: {
        customer: true,
        lines: true,
        payments: true,
        serviceOrder: { select: { reference: true } },
      },
    });
  }

  /**
   * Création de facture depuis un devis (Point 9).
   * Pas de $transaction interactif — incompatible avec pgbouncer (Supabase pooler).
   */
  async createInvoiceFromQuote(quoteId: string, userId: string, garageId?: string | null) {
    const quote = await this.prisma.quote.findUnique({
      where: { id: quoteId },
      include: {
        lines: true,
        serviceOrder: {
          include: {
            observations: {
              where: { includeInQuote: true, quotedAt: null },
            },
          },
        },
      },
    });

    if (!quote) throw new NotFoundException('Devis introuvable');
    if (quote.status !== 'APPROVED') throw new BadRequestException('Le devis doit être APPROUVÉ');

    const subtotal = Number(quote.subtotalXaf);
    const observations = quote.serviceOrder?.observations || [];

    const invoice = await this.prisma.invoice.create({
      data: {
        ...(garageId ? { garageId } : quote.garageId ? { garageId: quote.garageId } : {}),
        serviceOrderId: quote.serviceOrderId,
        quoteId: quote.id,
        customerId: quote.customerId,
        subtotalXaf: subtotal,
        taxRate: quote.taxRate,
        taxAmountXaf: quote.taxAmountXaf,
        stampDutyXaf: quote.stampDutyXaf,
        totalXaf: quote.totalXaf,
        status: 'ISSUED',
        createdBy: userId,
        issuedAt: new Date(),
        dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        lines: {
          create: quote.lines
            .filter((line) => line.partStatus !== 'CANCELLED' && Number(line.quantity) > 0)
            .map((line) => ({
            lineType: line.lineType,
            description: line.description || 'Service/Pièce',
            quantity: line.quantity,
            unitPriceXaf: line.unitPriceXaf,
            discountPct: line.discountPct,
          })),
        },
      },
    });

    if (observations.length > 0) {
      await this.prisma.technicianObservation.updateMany({
        where: { id: { in: observations.map((o) => o.id) } },
        data: { quotedAt: new Date() },
      });
    }

    await this.prisma.quote.update({
      where: { id: quoteId },
      data: { status: 'BILLED' },
    });

    return invoice;
  }

  /**
   * Enregistrement de paiement avec clé d'idempotence.
   * Pas de $transaction interactif — incompatible avec pgbouncer (Supabase pooler).
   */
  async recordPayment(data: {
    invoiceId: string;
    amount: number;
    method: PaymentMethod;
    userId: string;
    idempotencyKey: string;
    garageId?: string | null;
  }) {
    const payment = await this.prisma.payment.create({
      data: {
        ...(data.garageId ? { garageId: data.garageId } : {}),
        invoiceId: data.invoiceId,
        amountXaf: data.amount,
        method: data.method,
        idempotencyKey: data.idempotencyKey,
        recordedBy: data.userId,
        status: 'CONFIRMED',
        paidAt: new Date(),
      },
    }).catch((err) => {
      if (err.code === 'P2002') {
        throw new BadRequestException('Ce paiement a déjà été enregistré (clé d\'idempotence active)');
      }
      throw err;
    });

    const agg = await this.prisma.payment.aggregate({
      _sum: { amountXaf: true },
      where: { invoiceId: data.invoiceId, status: 'CONFIRMED' },
    });
    const totalPaid = Number(agg._sum.amountXaf ?? 0);

    const invoice = await this.prisma.invoice.findUnique({
      where: { id: data.invoiceId },
      select: {
        id: true,
        reference: true,
        totalXaf: true,
        status: true,
        serviceOrderId: true,
        serviceOrder: { select: { reference: true } },
        customer: { select: { firstName: true, lastName: true, companyName: true, customerType: true } },
      },
    });
    if (!invoice) throw new NotFoundException('Facture introuvable');

    const totalDue = Number(invoice.totalXaf);
    const balance = Math.max(totalDue - totalPaid, 0);
    const newStatus = balance <= 0 ? 'PAID' : totalPaid > 0 ? 'PARTIAL' : invoice.status;

    await this.prisma.invoice.update({
      where: { id: data.invoiceId },
      data: {
        amountPaidXaf: totalPaid,
        status: newStatus as typeof invoice.status,
        paidAt: balance <= 0 ? new Date() : null,
      },
    });

    const autoClosedOtId =
      balance <= 0 && invoice.serviceOrderId ? invoice.serviceOrderId : null;

    if (autoClosedOtId) {
      try {
        const { closed } = await this.workshopService.closeServiceOrderAfterFullPayment(
          autoClosedOtId,
          data.userId,
          { reason: `Soldé automatiquement — clôture OT (facture ${invoice.reference ?? data.invoiceId})` },
        );
        if (closed) {
          this.logger.log(`OT ${autoClosedOtId} → CLOSED automatiquement`);
        }
      } catch (err) {
        this.logger.warn(`Auto-CLOSED ignoré pour OT ${autoClosedOtId}: ${(err as Error).message}`);
      }
    }

    setImmediate(async () => {
      try {
        const recipientIds = await this.notifications.getUserIdsByRoles(['CHEF_ATELIER', 'ADMIN', 'SUPER_ADMIN']);
        if (recipientIds.length === 0) return;

        const customerName = invoice.customer?.customerType === 'COMPANY'
          ? (invoice.customer.companyName ?? 'Client')
          : [invoice.customer?.firstName, invoice.customer?.lastName].filter(Boolean).join(' ') || 'Client';

        const paymentLabel = newStatus === 'PAID' ? 'Paiement total encaissé' : 'Paiement partiel encaissé';
        const amountLabel = Number(data.amount).toLocaleString('fr-FR');
        const remainingLabel = balance.toLocaleString('fr-FR');
        const otRef = invoice.serviceOrder?.reference ? `OT ${invoice.serviceOrder.reference}` : 'OT';

        await this.notifications.createInApp({
          recipientIds,
          title: paymentLabel,
          body: `${invoice.reference} · ${customerName} · ${amountLabel} XAF encaissés · Reste: ${remainingLabel} XAF`,
          link: invoice.serviceOrderId ? `/workshop/${invoice.serviceOrderId}` : '/billing',
          serviceOrderId: invoice.serviceOrderId ?? undefined,
        });
        this.logger.log(`Notification encaissement envoyée (${invoice.id}) pour ${otRef}`);
      } catch (err) {
        this.logger.warn(`Notification encaissement échouée (${invoice.id}): ${(err as Error).message}`);
      }
    });

    return payment;
  }

  async getCashClosureSummary(dateIso?: string) {
    const target = dateIso ? new Date(dateIso) : new Date();
    if (Number.isNaN(target.getTime())) {
      throw new BadRequestException('Date de clôture invalide');
    }

    const start = new Date(target);
    start.setHours(0, 0, 0, 0);
    const end = new Date(target);
    end.setHours(23, 59, 59, 999);

    const payments = await this.prisma.payment.findMany({
      where: {
        status: 'CONFIRMED',
        paidAt: { gte: start, lte: end },
      },
      select: {
        id: true,
        method: true,
        amountXaf: true,
        paidAt: true,
      },
    });

    const totalsByMethod = payments.reduce<Record<string, number>>((acc, p) => {
      const key = p.method;
      acc[key] = (acc[key] ?? 0) + Number(p.amountXaf);
      return acc;
    }, {});

    const totalCollected = Object.values(totalsByMethod).reduce((sum, n) => sum + n, 0);
    const expectedCash = totalsByMethod.CASH ?? 0;

    const closures = await this.prisma.auditLog.findMany({
      where: {
        entityType: 'CashClosure',
        action: 'CLOSE_DAY',
        metadata: {
          path: ['date'],
          equals: start.toISOString().split('T')[0],
        },
      },
      select: {
        id: true,
        metadata: true,
        performedAt: true,
        performer: { select: { firstName: true, lastName: true } },
      },
      orderBy: { performedAt: 'desc' },
      take: 20,
    });

    return {
      date: start.toISOString().split('T')[0],
      totalsByMethod,
      paymentCount: payments.length,
      totalCollected,
      expectedCash,
      closures: closures.map((c) => ({
        id: c.id,
        performedAt: c.performedAt,
        performedBy: c.performer ? `${c.performer.firstName ?? ''} ${c.performer.lastName ?? ''}`.trim() : null,
        metadata: c.metadata,
      })),
    };
  }

  async closeCashDay(data: { userId: string; dateIso?: string; countedCash?: number; notes?: string }) {
    const summary = await this.getCashClosureSummary(data.dateIso);
    const countedCash = data.countedCash ?? null;
    const variance = countedCash != null ? countedCash - summary.expectedCash : null;

    const metadata = {
      date: summary.date,
      totalCollected: summary.totalCollected,
      expectedCash: summary.expectedCash,
      countedCash,
      variance,
      paymentCount: summary.paymentCount,
      totalsByMethod: summary.totalsByMethod,
      notes: data.notes?.trim() || null,
    };

    const created = await this.prisma.auditLog.create({
      data: {
        entityType: 'CashClosure',
        entityId: data.userId,
        action: 'CLOSE_DAY',
        performedBy: data.userId,
        metadata: metadata as any,
        fieldChanges: Prisma.JsonNull,
      },
      select: { id: true, performedAt: true, metadata: true },
    });

    return {
      id: created.id,
      performedAt: created.performedAt,
      ...metadata,
    };
  }
}
