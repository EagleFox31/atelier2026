
import { Injectable, BadRequestException, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { assertOTInGarage, assertPartInGarage, requireGarageId } from '../../shared/garage/garage-scope';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { StockMovementType, PartStatus } from '@prisma/client';

@Injectable()
export class StockService {
  private readonly logger = new Logger(StockService.name);

  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService,
    @InjectQueue('stock-alerts') private stockAlertsQueue: Queue,
  ) {}

  /**
   * Application d'un mouvement de stock (Point 8)
   * Note: Le trigger SQL fn_apply_stock_movement gère la logique de calcul de qty_in_stock
   * et le verrouillage pessimiste (FOR UPDATE) lors de l'INSERT dans stock_movements.
   */
  async applyMovement(data: {
    partId: string;
    type: StockMovementType;
    quantity: number;
    userId: string;
    serviceOrderId?: string;
    referenceDoc?: string;
    unitPriceXaf?: number;
    garageId?: string | null;
  }) {
    const g = requireGarageId(data.garageId);
    await assertPartInGarage(this.prisma, data.partId, g);
    if (data.serviceOrderId) {
      await assertOTInGarage(this.prisma, data.serviceOrderId, g);
    }
    return this.prisma.$transaction(async (tx) => {
      const movement = await tx.stockMovement.create({
        data: {
          garageId: g,
          partId: data.partId,
          movementType: data.type,
          quantity: data.quantity,
          performedBy: data.userId,
          serviceOrderId: data.serviceOrderId,
          referenceDoc: data.referenceDoc,
          unitPriceXaf: data.unitPriceXaf,
          qtyBefore: 0,
          qtyAfter: 0,
        },
      });

      // 2. Tâche asynchrone pour les alertes (BASE) - Post-transaction
      // On le fait via setImmediate pour simuler le "post-commit" ou on attend le retour de la méthode
      setImmediate(async () => {
        try {
          const part = await this.prisma.partsCatalog.findUnique({ where: { id: data.partId } });
          if (part && part.qtyInStock <= part.minThreshold) {
            await this.stockAlertsQueue.add('low-stock', {
              partId: part.id,
              reference: part.reference,
              name: part.nameFr,
              currentQty: part.qtyInStock,
              threshold: part.minThreshold,
            });
          }
        } catch (err) {
          this.logger.error(`Échec alerte stock bas pour pièce ${data.partId}`, err);
        }
      });

      return movement;
    });
  }

  /**
   * ASP (Achat Sur Place) : Entrée + Sortie immédiate (Point 8)
   */
  async recordASP(data: {
    partId: string;
    serviceOrderId: string;
    quantity: number;
    purchasePrice: number;
    salePrice: number;
    userId: string;
    supplierName: string;
    garageId?: string | null;
  }) {
    const g = requireGarageId(data.garageId);
    await assertPartInGarage(this.prisma, data.partId, g);
    await assertOTInGarage(this.prisma, data.serviceOrderId, g);
    return this.prisma.$transaction(async (tx) => {
      // 1. Création de l'enregistrement ASP
      const asp = await tx.aSPPurchase.create({
        data: {
          serviceOrderId: data.serviceOrderId,
          partId: data.partId,
          partDescription: `ASP: ${data.supplierName}`,
          quantity: data.quantity,
          supplierName: data.supplierName,
          purchasePriceXaf: data.purchasePrice,
          salePriceXaf: data.salePrice,
          status: 'RECEIVED',
          receivedAt: new Date(),
          authorizedBy: data.userId,
          authorizedAt: new Date(),
          createdBy: data.userId,
        },
      });

      // 2. Entrée en stock (PURCHASE)
      await tx.stockMovement.create({
        data: {
          partId: data.partId,
          movementType: 'PURCHASE',
          quantity: data.quantity,
          performedBy: data.userId,
          serviceOrderId: data.serviceOrderId,
          referenceDoc: `ASP-${asp.reference}`,
          qtyBefore: 0,
          qtyAfter: 0,
        },
      });

      // 3. Sortie immédiate (OT_CONSUMPTION)
      await tx.stockMovement.create({
        data: {
          partId: data.partId,
          movementType: 'OT_CONSUMPTION',
          quantity: -data.quantity,
          performedBy: data.userId,
          serviceOrderId: data.serviceOrderId,
          referenceDoc: `ASP-${asp.reference}`,
          qtyBefore: 0,
          qtyAfter: 0,
        },
      });

      return asp;
    }).then((asp) => {
      setImmediate(async () => {
        try {
          const order = await this.prisma.serviceOrder.findUnique({
            where: { id: data.serviceOrderId },
            select: {
              reference: true,
              garageId: true,
              vehicle: { select: { plateNumber: true } },
            },
          });
          const recipientIds = await this.notifications.getUserIdsByRoles([
            'CHEF_ATELIER', 'ADMIN', 'SUPER_ADMIN',
          ], order?.garageId ?? null);
          if (recipientIds.length === 0) return;
          const plate = order?.vehicle?.plateNumber ?? order?.reference ?? data.serviceOrderId;

          await this.notifications.createInApp({
            recipientIds,
            title: 'Pièce ASP reçue',
            body: `${asp.partDescription ?? 'Pièce ASP'} — OT ${plate} peut avancer.`,
            link: `/workshop/${data.serviceOrderId}`,
            serviceOrderId: data.serviceOrderId,
          });
        } catch (err) {
          this.logger.warn(`Échec notification ASP reçu OT ${data.serviceOrderId}: ${(err as Error).message}`);
        }
      });
      return asp;
    });
  }

  async getPart(id: string, garageId?: string | null) {
    const g = requireGarageId(garageId);
    const part = await this.prisma.partsCatalog.findFirst({
      where: { id, garageId: g },
      include: { supplier: true },
    });
    if (!part) throw new NotFoundException('Pièce introuvable');
    return part;
  }
}
