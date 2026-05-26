import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { PartStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { computeAmounts } from '../../shared/fiscal/compute-amounts';

export type PartReconciliationItem = {
  quoteLineId: string;
  used: boolean;
  aspPurchasePrice?: number;
};

@Injectable()
export class PartsFlowService {
  private readonly logger = new Logger(PartsFlowService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  /**
   * MVP 1 — Devis approuvé : réserve le stock disponible, ASP PENDING si rupture.
   */
  async onQuoteApproved(params: {
    quoteId: string;
    serviceOrderId: string;
    userId: string;
    otReference?: string;
  }) {
    const lines = await this.prisma.quoteLine.findMany({
      where: { quoteId: params.quoteId, partId: { not: null } },
      include: { part: true },
    });

    const missing: { ref: string; name: string; qty: number }[] = [];
    let reserved = 0;
    let aspCreated = 0;

    for (const line of lines) {
      if (!line.partId || !line.part) continue;
      if (
        line.partStatus === PartStatus.STOCK_RESERVED
        || line.partStatus === PartStatus.CONSUMED
        || line.partStatus === PartStatus.CANCELLED
      ) {
        continue;
      }

      const qty = Number(line.quantity);
      const inStock = Number(line.part.qtyInStock);
      const reservedQty = Number(line.part.qtyReserved);
      const available = inStock - reservedQty;

      if (available >= qty) {
        await this.prisma.partsCatalog.update({
          where: { id: line.partId },
          data: { qtyReserved: { increment: qty } },
        });
        await this.prisma.quoteLine.update({
          where: { id: line.id },
          data: { partStatus: PartStatus.STOCK_RESERVED },
        });
        reserved += 1;
      } else {
        await this.prisma.quoteLine.update({
          where: { id: line.id },
          data: { partStatus: PartStatus.ASP_ORDERED },
        });

        const existingAsp = await this.prisma.aSPPurchase.findFirst({
          where: {
            quoteLineId: line.id,
            status: { not: 'CANCELLED' },
          },
        });

        if (!existingAsp) {
          const purchaseEst = line.part.purchasePriceXaf
            ? Number(line.part.purchasePriceXaf)
            : Math.round(Number(line.unitPriceXaf) * 0.65);

          await this.prisma.aSPPurchase.create({
            data: {
              serviceOrderId: params.serviceOrderId,
              quoteLineId: line.id,
              partId: line.partId,
              partDescription: line.part.nameFr ?? line.description ?? 'Pièce ASP',
              quantity: line.quantity,
              supplierName: 'À renseigner',
              purchasePriceXaf: purchaseEst,
              salePriceXaf: line.unitPriceXaf,
              status: 'PENDING',
              createdBy: params.userId,
            },
          });
          aspCreated += 1;
        }

        missing.push({
          ref: line.part.reference,
          name: line.part.nameFr,
          qty,
        });
      }
    }

    // Pièces saisies librement (hors catalogue) → ASP à la commande
    const freeTextParts = await this.prisma.quoteLine.findMany({
      where: {
        quoteId: params.quoteId,
        lineType: 'PART',
        partId: null,
        NOT: { partStatus: PartStatus.CANCELLED },
      },
    });

    for (const line of freeTextParts) {
      const label = line.description?.trim();
      if (!label) continue;
      if (line.partStatus === PartStatus.ASP_ORDERED) continue;

      await this.prisma.quoteLine.update({
        where: { id: line.id },
        data: { partStatus: PartStatus.ASP_ORDERED },
      });

      const existingAsp = await this.prisma.aSPPurchase.findFirst({
        where: { quoteLineId: line.id, status: { not: 'CANCELLED' } },
      });

      if (!existingAsp) {
        await this.prisma.aSPPurchase.create({
          data: {
            serviceOrderId: params.serviceOrderId,
            quoteLineId: line.id,
            partDescription: label,
            quantity: line.quantity,
            supplierName: 'À renseigner',
            purchasePriceXaf: Math.round(Number(line.unitPriceXaf) * 0.65),
            salePriceXaf: line.unitPriceXaf,
            status: 'PENDING',
            createdBy: params.userId,
          },
        });
        aspCreated += 1;
      }

      missing.push({ ref: 'ASP', name: label, qty: Number(line.quantity) });
    }

    if (missing.length > 0) {
      try {
        const recipientIds = await this.notifications.getUserIdsByRoles([
          'CHEF_ATELIER', 'ADMIN', 'SUPER_ADMIN',
        ]);
        const otRef = params.otReference ? `OT ${params.otReference}` : 'OT';
        const detail = missing
          .slice(0, 3)
          .map((m) => `${m.ref} (×${m.qty})`)
          .join(', ');
        await this.notifications.createInApp({
          recipientIds,
          title: 'Alerte stock — pièces manquantes',
          body: `${otRef} : ${detail}${missing.length > 3 ? '…' : ''}. ASP créé(s) en attente.`,
          link: `/workshop/${params.serviceOrderId}`,
          serviceOrderId: params.serviceOrderId,
        });
      } catch (err) {
        this.logger.warn(`Notification rupture stock OT ${params.serviceOrderId}: ${(err as Error).message}`);
      }
    }

    return { reserved, aspCreated, missingCount: missing.length };
  }

  /**
   * MVP 2 — Lancement travaux : déstockage physique des pièces réservées.
   */
  async consumeReservedParts(serviceOrderId: string, userId: string) {
    const lines = await this.prisma.quoteLine.findMany({
      where: {
        partId: { not: null },
        partStatus: PartStatus.STOCK_RESERVED,
        quote: { serviceOrderId, status: { in: ['APPROVED', 'BILLED'] } },
      },
      include: { part: true },
    });

    let consumed = 0;

    for (const line of lines) {
      if (!line.partId) continue;
      const qty = Number(line.quantity);

      const part = await this.prisma.partsCatalog.findUnique({ where: { id: line.partId } });
      if (!part) continue;

      const qtyBefore = Number(part.qtyInStock);
      const reservedBefore = Number(part.qtyReserved);
      const qtyAfter = qtyBefore - qty;
      const reservedAfter = Math.max(reservedBefore - qty, 0);

      if (qtyAfter < 0) {
        throw new BadRequestException(
          `Stock insuffisant pour ${part.reference} (disponible: ${qtyBefore}, requis: ${qty})`,
        );
      }

      await this.prisma.partsCatalog.update({
        where: { id: line.partId },
        data: {
          qtyInStock: qtyAfter,
          qtyReserved: reservedAfter,
        },
      });

      await this.prisma.stockMovement.create({
        data: {
          partId: line.partId,
          movementType: 'OT_CONSUMPTION',
          quantity: new Prisma.Decimal(-qty),
          serviceOrderId,
          quoteLineId: line.id,
          performedBy: userId,
          qtyBefore: new Prisma.Decimal(qtyBefore),
          qtyAfter: new Prisma.Decimal(qtyAfter),
          notes: 'Déstockage auto — lancement travaux',
        },
      });

      await this.prisma.quoteLine.update({
        where: { id: line.id },
        data: { partStatus: PartStatus.CONSUMED },
      });

      consumed += 1;
    }

    return { consumed };
  }

  /**
   * Annulation OT — libère les réservations et ASP en attente.
   */
  async releaseReservationsForOrder(serviceOrderId: string) {
    const lines = await this.prisma.quoteLine.findMany({
      where: {
        partStatus: PartStatus.STOCK_RESERVED,
        quote: { serviceOrderId },
      },
    });

    for (const line of lines) {
      if (!line.partId) continue;
      const qty = Number(line.quantity);
      await this.prisma.partsCatalog.update({
        where: { id: line.partId },
        data: { qtyReserved: { decrement: qty } },
      });
      await this.prisma.quoteLine.update({
        where: { id: line.id },
        data: { partStatus: PartStatus.PENDING },
      });
    }

    await this.prisma.aSPPurchase.updateMany({
      where: { serviceOrderId, status: 'PENDING' },
      data: { status: 'CANCELLED' },
    });
  }

  /**
   * MVP 3 — Contrôle qualité : pièces non utilisées → retour stock ; ASP → prix réel.
   */
  async reconcilePartsAtQc(
    serviceOrderId: string,
    userId: string,
    items: PartReconciliationItem[],
  ) {
    const quoteIds: string[] = [];

    for (const item of items) {
      const line = await this.prisma.quoteLine.findFirst({
        where: {
          id: item.quoteLineId,
          quote: { serviceOrderId },
        },
        include: { part: true, quote: true },
      });

      if (!line || !line.partId) continue;
      quoteIds.push(line.quoteId);

      if (!item.used && line.partStatus === PartStatus.CONSUMED) {
        const qty = Number(line.quantity);
        const part = await this.prisma.partsCatalog.findUnique({ where: { id: line.partId } });
        if (!part) continue;

        const qtyBefore = Number(part.qtyInStock);
        const qtyAfter = qtyBefore + qty;

        await this.prisma.partsCatalog.update({
          where: { id: line.partId },
          data: { qtyInStock: qtyAfter },
        });

        await this.prisma.stockMovement.create({
          data: {
            partId: line.partId,
            movementType: 'RETURN',
            quantity: new Prisma.Decimal(qty),
            serviceOrderId,
            quoteLineId: line.id,
            performedBy: userId,
            qtyBefore: new Prisma.Decimal(qtyBefore),
            qtyAfter: new Prisma.Decimal(qtyAfter),
            notes: 'Retour stock — pièce non utilisée (QC)',
          },
        });

        await this.prisma.quoteLine.update({
          where: { id: line.id },
          data: {
            partStatus: PartStatus.CANCELLED,
            quantity: new Prisma.Decimal(0),
            lineTotalXaf: new Prisma.Decimal(0),
            description: line.description
              ? `${line.description} [non utilisée — QC]`
              : '[Pièce non utilisée — QC]',
          },
        });
      }

      if (item.aspPurchasePrice != null && item.aspPurchasePrice >= 0) {
        await this.prisma.aSPPurchase.updateMany({
          where: {
            quoteLineId: line.id,
            serviceOrderId,
            status: { in: ['PENDING', 'AUTHORIZED', 'RECEIVED'] },
          },
          data: {
            purchasePriceXaf: item.aspPurchasePrice,
            status: 'ACCOUNTED',
            accountedBy: userId,
            accountedAt: new Date(),
          },
        });
      }
    }

    for (const quoteId of [...new Set(quoteIds)]) {
      await this.recalculateQuoteSubtotal(quoteId);
    }

    return { reconciled: items.length };
  }

  private async recalculateQuoteSubtotal(quoteId: string) {
    const lines = await this.prisma.quoteLine.findMany({ where: { quoteId } });
    const subtotal = lines.reduce((sum, l) => {
      if (l.partStatus === PartStatus.CANCELLED || Number(l.quantity) <= 0) return sum;
      return sum + Number(l.lineTotalXaf);
    }, 0);

    const amounts = computeAmounts(subtotal);
    await this.prisma.quote.update({
      where: { id: quoteId },
      data: {
        subtotalXaf: amounts.subtotal,
        taxAmountXaf: amounts.taxAmount,
        stampDutyXaf: amounts.stampDuty,
        totalXaf: amounts.total,
      },
    });
  }
}
