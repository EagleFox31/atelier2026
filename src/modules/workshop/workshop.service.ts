
import { Injectable, BadRequestException, ConflictException, Logger, ForbiddenException, NotFoundException, Optional } from '@nestjs/common';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { AuditService } from '../../shared/audit/audit.service';
import { NotificationsService, OT_CREATED_NOTIFY_ROLES } from '../notifications/notifications.service';
import { PartsFlowService } from '../stock/parts-flow.service';
import type { PartReconciliationItem } from '../stock/parts-flow.service';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { OTStatus, PartStatus } from '@prisma/client';
import {
  CreateServiceOrderDto,
  UpdateOTDto,
  CreateObservationDto,
  CreateWorkItemDto,
  CreateReceptionCheckDto,
  CreateQualityControlDto,
} from './dto/workshop.dto';
import {
  getWorkshopUserRoleCodes,
  isPureTechnician,
  isPureTechnicianFromCodes,
  technicianAssignmentFilter,
  type WorkshopUser,
} from './workshop-access.helpers';
import { EventsService } from '../events/events.service';

/** Statuts où un technicien assigné peut saisir un constat */
const TECH_OBSERVATION_STATUSES: OTStatus[] = [
  OTStatus.RECEIVED,
  OTStatus.DIAGNOSING,
  OTStatus.IN_PROGRESS,
  OTStatus.QC_REJECTED,
];

/**
 * Définition des transitions autorisées (Point 7)
 */
export const OT_TRANSITIONS: Record<OTStatus, OTStatus[]> = {
  [OTStatus.DRAFT]: [OTStatus.RECEIVED, OTStatus.CANCELLED],
  [OTStatus.RECEIVED]: [OTStatus.DIAGNOSING, OTStatus.CANCELLED],
  [OTStatus.DIAGNOSING]: [OTStatus.QUOTE_PENDING, OTStatus.CANCELLED],
  [OTStatus.QUOTE_PENDING]: [OTStatus.CANCELLED],
  [OTStatus.QUOTE_APPROVED]: [OTStatus.IN_PROGRESS, OTStatus.CANCELLED],
  [OTStatus.IN_PROGRESS]: [OTStatus.QC_PENDING, OTStatus.CANCELLED],
  [OTStatus.QC_PENDING]: [OTStatus.QC_REJECTED, OTStatus.READY],
  [OTStatus.QC_REJECTED]: [OTStatus.IN_PROGRESS, OTStatus.CANCELLED],
  [OTStatus.QC_DONE]: [OTStatus.READY], // legacy — OTs déjà en QC_DONE
  [OTStatus.READY]: [OTStatus.INVOICED, OTStatus.CLOSED],
  [OTStatus.INVOICED]: [OTStatus.CLOSED],
  [OTStatus.CLOSED]: [],
  [OTStatus.CANCELLED]: [OTStatus.RECEIVED], // Rare mais possible si erreur
};

export const TRANSITION_ROLES: Record<string, string[]> = {
  [`${OTStatus.DRAFT}->${OTStatus.RECEIVED}`]: ['RECEPTIONNISTE', 'CHEF_ATELIER', 'ADMIN', 'SUPER_ADMIN'],
  [`${OTStatus.RECEIVED}->${OTStatus.DIAGNOSING}`]: ['TECHNICIEN', 'CHEF_ATELIER', 'ADMIN', 'SUPER_ADMIN'],
  [`${OTStatus.DIAGNOSING}->${OTStatus.QUOTE_PENDING}`]: ['CHEF_ATELIER', 'ADMIN', 'SUPER_ADMIN'],
  [`${OTStatus.QUOTE_APPROVED}->${OTStatus.IN_PROGRESS}`]: ['TECHNICIEN', 'CHEF_ATELIER', 'ADMIN', 'SUPER_ADMIN'],
  [`${OTStatus.IN_PROGRESS}->${OTStatus.QC_PENDING}`]: ['TECHNICIEN', 'CHEF_ATELIER', 'ADMIN', 'SUPER_ADMIN'],
  [`${OTStatus.QC_PENDING}->${OTStatus.READY}`]: ['CHEF_ATELIER', 'ADMIN', 'SUPER_ADMIN'],
  [`${OTStatus.QC_PENDING}->${OTStatus.QC_REJECTED}`]: ['CHEF_ATELIER', 'ADMIN', 'SUPER_ADMIN'],
  [`${OTStatus.QC_REJECTED}->${OTStatus.IN_PROGRESS}`]: ['TECHNICIEN', 'CHEF_ATELIER', 'ADMIN', 'SUPER_ADMIN'],
  [`${OTStatus.QC_DONE}->${OTStatus.READY}`]: ['CHEF_ATELIER', 'ADMIN', 'SUPER_ADMIN'],
  [`${OTStatus.READY}->${OTStatus.INVOICED}`]: ['CHEF_ATELIER', 'ADMIN', 'SUPER_ADMIN', 'SYSTEM'],
  [`${OTStatus.READY}->${OTStatus.CLOSED}`]: ['CAISSIER', 'ADMIN', 'SUPER_ADMIN', 'SYSTEM'],
  [`${OTStatus.INVOICED}->${OTStatus.CLOSED}`]: ['CAISSIER', 'ADMIN', 'SUPER_ADMIN', 'SYSTEM'],
  [`*->${OTStatus.CANCELLED}`]: ['CHEF_ATELIER', 'ADMIN', 'SUPER_ADMIN'],
};

@Injectable()
export class WorkshopService {
  private readonly logger = new Logger(WorkshopService.name);

  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
    private notifications: NotificationsService,
    private partsFlow: PartsFlowService,
    @InjectQueue('sms-notifications') private smsQueue: Queue,
    @Optional() private events?: EventsService,
  ) {}

  listOTs(status?: OTStatus, search?: string, user?: WorkshopUser & { garageId?: string | null }) {
    const garageId = user?.garageId;
    const where: Record<string, unknown> = {
      ...technicianAssignmentFilter(user),
      ...(garageId ? { garageId } : {}),
    };
    if (status) where.status = status;
    if (search) {
      where.OR = [
        { reference: { contains: search, mode: 'insensitive' } },
        { clientComplaint: { contains: search, mode: 'insensitive' } },
        { customer: { lastName: { contains: search, mode: 'insensitive' } } },
        { vehicle: { plateNumber: { contains: search, mode: 'insensitive' } } },
      ];
    }

    return this.prisma.serviceOrder.findMany({
      where,
      include: {
        customer: true,
        vehicle: { include: { make: true, model: true } },
        chef: true,
        workItems: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getOT(id: string, user?: WorkshopUser) {
    const ot = await this.prisma.serviceOrder.findUnique({
      where: { id },
      include: {
        customer: true,
        vehicle: { include: { make: true, model: true } },
        chef: true,
        workItems: {
          include: { laborCatalog: true, technician: true },
        },
        observations: {
          include: { observer: true },
          orderBy: { observedAt: 'asc' },
        },
        receptionChecks: {
          orderBy: { checkedAt: 'desc' },
          include: {
            checker: { select: { firstName: true, lastName: true } },
            checkItems: { include: { catalog: true } },
          },
        },
        statusHistory: {
          include: { user: true },
          orderBy: { changedAt: 'desc' },
        },
        quotes: {
          include: { lines: { include: { part: true } } },
        },
        invoices: {
          select: { id: true, reference: true, status: true, totalXaf: true, amountPaidXaf: true, issuedAt: true },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!ot) throw new NotFoundException('Ordre de travail introuvable');

    if (isPureTechnician(user) && ot.assignedChef !== user!.id) {
      throw new ForbiddenException('Cet ordre de travail ne vous est pas assigné');
    }

    return ot;
  }

  async createOT(body: CreateServiceOrderDto, openedByUserId: string, garageId?: string) {
    const ot = await this.prisma.$transaction(async (tx) => {
      const created = await tx.serviceOrder.create({
        data: {
          garageId: garageId ?? null,
          vehicleId: body.vehicleId,
          customerId: body.customerId,
          openedBy: openedByUserId,
          clientComplaint: body.clientComplaint,
          priority: body.priority || 'NORMAL',
          mileageIn: body.mileageIn,
          promisedAt: body.promisedAt ? new Date(body.promisedAt) : null,
          status: body.mileageIn ? OTStatus.RECEIVED : OTStatus.DRAFT,
        },
      });

      if (body.appointmentId) {
        await tx.appointment.update({
          where: { id: body.appointmentId },
          data: {
            serviceOrderId: created.id,
            status: 'COMPLETED',
          },
        });
      }

      return created;
    });

    // Notifier les chefs d'atelier qu'un nouvel OT a été créé
    setImmediate(async () => {
      try {
        const recipientIds = await this.notifications.getUserIdsByRoles([...OT_CREATED_NOTIFY_ROLES]);
        if (recipientIds.length === 0) return;
        const vehicle = await this.prisma.vehicle.findUnique({
          where: { id: ot.vehicleId },
          select: { plateNumber: true },
        });
        const plate = vehicle?.plateNumber ?? ot.vehicleId;
        await this.notifications.createInApp({
          recipientIds,
          title: 'Nouvel ordre de travail',
          body: `Un OT a été créé pour le véhicule ${plate}.`,
          link: `/workshop/${ot.id}`,
          serviceOrderId: ot.id,
        });
      } catch (err) {
        this.logger.error(`Échec notification OT créé pour ${ot.id}`, err);
      }
    });

    this.events?.emitToRoles(['CHEF_ATELIER', 'ADMIN', 'SUPER_ADMIN'], {
      type: 'ot.created',
      otId: ot.id,
    });

    return ot;
  }

  async addObservation(otId: string, user: WorkshopUser, body: CreateObservationDto) {
    const ot = await this.prisma.serviceOrder.findUnique({
      where: { id: otId },
      select: { id: true, status: true, assignedChef: true, vehicleId: true },
    });

    if (!ot) throw new NotFoundException('Ordre de travail introuvable');

    if (ot.status === OTStatus.CLOSED || ot.status === OTStatus.CANCELLED) {
      throw new BadRequestException('Impossible d\'ajouter un constat sur un OT clôturé ou annulé');
    }

    const roleCodes = getWorkshopUserRoleCodes(user);

    if (isPureTechnicianFromCodes(roleCodes)) {
      if (ot.assignedChef !== user.id) {
        throw new ForbiddenException('Cet ordre de travail ne vous est pas assigné');
      }
      if (!TECH_OBSERVATION_STATUSES.includes(ot.status)) {
        throw new ForbiddenException('Vous ne pouvez pas ajouter de constat à ce stade de l\'OT');
      }
    }

    const observation = await this.prisma.technicianObservation.create({
      data: {
        serviceOrderId: otId,
        observedBy: user.id,
        description: body.description,
        category: body.category ?? 'AUTRE',
        severity: body.severity ?? 'INFO',
        includeInQuote: body.includeInQuote !== false,
      },
    });

    const vehicleId = ot.vehicleId;
    setImmediate(async () => {
      try {
        const recipientIds = await this.notifications.getUserIdsByRoles(['CHEF_ATELIER']);
        if (recipientIds.length === 0) return;
        const vehicle = await this.prisma.vehicle.findUnique({
          where: { id: vehicleId },
          select: { plateNumber: true },
        });
        const plate = vehicle?.plateNumber ?? vehicleId;
        await this.notifications.createInApp({
          recipientIds,
          title: 'Nouveau constat de diagnostic',
          body: `Un technicien a ajouté un constat sur le véhicule ${plate}.`,
          link: `/workshop/${otId}`,
          serviceOrderId: otId,
        });
      } catch (err) {
        this.logger.error(`Échec notification constat OT ${otId}`, err);
      }
    });

    return observation;
  }

  addWorkItem(otId: string, body: CreateWorkItemDto) {
    return this.prisma.oTWorkItem.create({
      data: {
        serviceOrderId: otId,
        laborCatalogId: body.laborCatalogId,
        quantity: body.quantity || 1,
        discountPct: body.discountPct || 0,
        unitPriceXaf: body.unitPriceXaf,
      },
    });
  }

  async addReceptionCheck(otId: string, checkedByUserId: string, body: CreateReceptionCheckDto) {
    const fuelLevel = body.fuelLevel ?? 4;

    let items = body.checkItems ?? [];
    if (items.length === 0) {
      const catalog = await this.prisma.receptionCheckCatalog.findMany({ where: { isActive: true } });
      items = catalog.map((c) => ({ catalogId: c.id, result: 'NA' as const }));
    }

    await this.prisma.serviceOrder.update({
      where: { id: otId },
      data: { mileageIn: body.mileageAtReception },
    });

    return this.prisma.receptionCheck.create({
      data: {
        serviceOrderId: otId,
        checkedBy: checkedByUserId,
        mileageAtReception: body.mileageAtReception,
        fuelLevel,
        globalNotes: body.globalNotes,
        checkItems: {
          create: items.map((item) => ({
            catalogId: item.catalogId,
            result: (item.result as 'OK' | 'WARNING' | 'CRITICAL' | 'NA') ?? 'NA',
            note: item.note,
          })),
        },
      },
      include: {
        checkItems: { include: { catalog: true } },
      },
    });
  }

  getLaborCatalog() {
    return this.prisma.laborCatalog.findMany({
      where: { isActive: true },
      orderBy: { category: 'asc' },
    });
  }

  getReceptionCatalog() {
    return this.prisma.receptionCheckCatalog.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
    });
  }

  async assignChef(otId: string, assignedChefId: string) {
    const ot = await this.prisma.serviceOrder.update({
      where: { id: otId },
      data: { assignedChef: assignedChefId },
      include: { vehicle: { select: { plateNumber: true } } },
    });

    setImmediate(async () => {
      try {
        await this.notifications.createInApp({
          recipientIds: [assignedChefId],
          title: 'OT vous a été assigné',
          body: `Le véhicule ${ot.vehicle?.plateNumber ?? otId} vous a été assigné.`,
          link: `/workshop/${otId}`,
          serviceOrderId: otId,
        });
      } catch (err) {
        this.logger.error(`Échec notification assignation OT ${otId}`, err);
      }
    });

    return ot;
  }

  async addQualityControl(otId: string, performedByUserId: string, body: CreateQualityControlDto) {
    const rows = await this.prisma.$queryRaw<[{ max_round: number }]>`
      SELECT COALESCE(MAX(round), 0) AS max_round
      FROM quality_controls
      WHERE service_order_id = ${otId}::uuid
    `;
    const round = Number(rows[0]?.max_round ?? 0) + 1;

    return this.prisma.qualityControl.create({
      data: {
        serviceOrderId: otId,
        round,
        performedBy: performedByUserId,
        overallResult: body.overallResult,
        checklist: body.checklist || [],
        returnNotes: body.returnNotes,
        isApproved: body.overallResult === 'OK',
      },
    });
  }

  removeWorkItem(otId: string, itemId: string) {
    return this.prisma.oTWorkItem.delete({
      where: { id: itemId, serviceOrderId: otId },
    });
  }

  /**
   * Passage d'un état à un autre avec validation métier (Point 7)
   */
  async updateStatus(
    otId: string,
    targetStatus: OTStatus,
    user: { id?: string; roles?: Array<{ role?: { code?: string }; code?: string }> },
    data: { reason?: string; cancellationReason?: string; partsReconciliation?: PartReconciliationItem[] },
    options?: { skipRbac?: boolean },
  ) {
    const userRoleCodes = (user.roles || []).map((ur) => ur.role?.code ?? (ur as { code?: string }).code ?? String(ur));
    return this.applyStatusChange(otId, targetStatus, user.id || 'SYSTEM', data, {
      ...options,
      userRoleCodes,
    });
  }

  /**
   * Transition automatique (billing, jobs) — sans contrôle RBAC utilisateur,
   * mais avec les mêmes règles métier et audit explicite.
   */
  async updateStatusBySystem(
    otId: string,
    targetStatus: OTStatus,
    performedByUserId: string,
    data: { reason?: string; cancellationReason?: string; partsReconciliation?: PartReconciliationItem[] },
  ) {
    return this.applyStatusChange(otId, targetStatus, performedByUserId, data, {
      skipRbac: true,
      automated: true,
    });
  }

  /**
   * Clôture OT après encaissement total (billing).
   * Seuls READY et INVOICED peuvent passer à CLOSED — les autres statuts indiquent
   * un dossier pas encore prêt côté atelier (transition refusée, fail-fast).
   */
  async closeServiceOrderAfterFullPayment(
    otId: string,
    performedByUserId: string,
    data: { reason?: string } = {},
  ): Promise<{ closed: boolean; finalStatus: OTStatus }> {
    const ot = await this.prisma.serviceOrder.findUnique({
      where: { id: otId },
      select: { id: true, status: true },
    });
    if (!ot) throw new NotFoundException('Ordre de travail introuvable');

    if (ot.status === OTStatus.CLOSED) {
      return { closed: true, finalStatus: OTStatus.CLOSED };
    }
    if (ot.status === OTStatus.CANCELLED) {
      return { closed: false, finalStatus: OTStatus.CANCELLED };
    }

    const closableFrom: OTStatus[] = [OTStatus.READY, OTStatus.INVOICED];
    if (!closableFrom.includes(ot.status)) {
      throw new BadRequestException(
        `Clôture auto impossible : l'OT est en ${ot.status} (requis : Prêt ou Facturé)`,
      );
    }

    const reason = data.reason ?? 'Soldé automatiquement — clôture OT';
    const result = await this.updateStatusBySystem(otId, OTStatus.CLOSED, performedByUserId, { reason });
    return { closed: true, finalStatus: result.status as OTStatus };
  }

  private async applyStatusChange(
    otId: string,
    targetStatus: OTStatus,
    performedByUserId: string,
    data: { reason?: string; cancellationReason?: string; partsReconciliation?: PartReconciliationItem[] },
    options?: { skipRbac?: boolean; automated?: boolean; userRoleCodes?: string[] },
  ) {
    // Pas de $transaction interactif — pgbouncer le coupe. Le verrou optimiste (version) suffit.

    // 1. Lecture de l'OT courant
    const ot = await this.prisma.serviceOrder.findUnique({
      where: { id: otId },
      include: {
        vehicle: true,
        workItems: true,
        quotes: { include: { lines: true } },
        observations: true,
      },
    });

    if (!ot) throw new NotFoundException('Ordre de travail introuvable');

    // Déjà au statut demandé (double-clic mobile, onglet stale) — idempotent
    if (targetStatus === ot.status) {
      return { id: otId, status: ot.status, vehicleId: ot.vehicleId };
    }

    // 2. Validation de la transition
    const allowed = OT_TRANSITIONS[ot.status];
    if (!allowed.includes(targetStatus)) {
      throw new BadRequestException(`Transition de ${ot.status} vers ${targetStatus} non autorisée`);
    }

    // 2.5. Validation RBAC (sauf transitions système explicites)
    if (!options?.skipRbac) {
      const transitionKey = targetStatus === OTStatus.CANCELLED ? `*->${OTStatus.CANCELLED}` : `${ot.status}->${targetStatus}`;
      const allowedRoles = TRANSITION_ROLES[transitionKey] || ['ADMIN', 'SUPER_ADMIN'];
      const userRoleCodes = options?.userRoleCodes ?? [];
      const hasRole = userRoleCodes.some((code) => allowedRoles.includes(code));
      if (!hasRole) {
        throw new ForbiddenException(`Accès refusé. Vous n'avez pas le rôle requis pour passer au statut ${targetStatus}`);
      }

      if (isPureTechnicianFromCodes(userRoleCodes) && ot.assignedChef !== performedByUserId) {
        throw new ForbiddenException('Cet ordre de travail ne vous est pas assigné');
      }
    }

    // 3. Règles métier (ORD-XXX)
    if (targetStatus === OTStatus.RECEIVED && !ot.mileageIn) {
      throw new BadRequestException('Kilométrage d\'entrée obligatoire pour le statut REÇU (ORD-001)');
    }

    if (targetStatus === OTStatus.QUOTE_PENDING && ot.observations.length === 0) {
      throw new BadRequestException('Au moins une observation du technicien est requise avant de passer en devis (ORD-002)');
    }

    if (targetStatus === OTStatus.READY) {
      const hasPendingParts = ot.quotes.flatMap(q => q.lines).some(
        line => line.partId && line.partStatus !== PartStatus.RECEIVED && line.partStatus !== PartStatus.CONSUMED
      );
      if (hasPendingParts) {
        throw new BadRequestException('Certaines pièces commandées ne sont pas encore reçues (ORD-003)');
      }
    }

    if (targetStatus === OTStatus.CANCELLED && !data.cancellationReason) {
      throw new BadRequestException('Un motif d\'annulation est obligatoire (ORD-004)');
    }

    if (
      targetStatus === OTStatus.QC_REJECTED
      && ot.status === OTStatus.QC_PENDING
      && !data.reason?.trim()
    ) {
      throw new BadRequestException('Un motif de refus est obligatoire pour le contrôle qualité (ORD-005)');
    }

    if (targetStatus === OTStatus.IN_PROGRESS && ot.status === OTStatus.QUOTE_APPROVED) {
      const hasApprovedQuote = ot.quotes.some((q) => q.status === 'APPROVED');
      if (!hasApprovedQuote) {
        throw new BadRequestException(
          'Approuvez le devis dans Facturation avant de démarrer les travaux (ORD-006)',
        );
      }
    }

    // 4. set_config + UPDATE dans une seule CTE atomique
    //    Le trigger fn_trg_ot_status_history lit app.current_user_id via set_config
    //    et enregistre le bon utilisateur dans ot_status_history.
    const closedAt    = targetStatus === OTStatus.CLOSED ? new Date() : ot.closedAt;
    const cancelReason = data.cancellationReason || ot.cancellationReason || null;

    const affected = await this.prisma.$executeRaw`
      WITH set_user AS (SELECT set_config('app.current_user_id', ${performedByUserId}, true))
      UPDATE service_orders
      SET
        status               = ${targetStatus}::"ot_status_t",
        version              = version + 1,
        cancellation_reason  = ${cancelReason},
        closed_at            = ${closedAt}
      WHERE id = ${otId}::uuid AND version = ${ot.version}
    `;

    if (affected === 0) {
      throw new ConflictException('L\'ordre de travail a été modifié par un autre utilisateur');
    }

    // Le trigger SQL peut retomber sur opened_by si set_config est perdu (pgbouncer) —
    // on force changed_by sur la transition qu'on vient d'écrire.
    const statusReason = data.reason?.trim() || null;

    await this.prisma.$executeRaw`
      UPDATE ot_status_history
      SET
        changed_by = ${performedByUserId}::uuid,
        reason     = ${statusReason}
      WHERE id = (
        SELECT id FROM ot_status_history
        WHERE service_order_id = ${otId}::uuid
          AND to_status = ${targetStatus}::"ot_status_t"
        ORDER BY changed_at DESC
        LIMIT 1
      )
    `;

    const updatedOT = { id: otId, status: targetStatus, vehicleId: ot.vehicleId };

    // 4b. Flux pièces — déstockage au lancement, libération si annulation, QC
    if (targetStatus === OTStatus.IN_PROGRESS && ot.status === OTStatus.QUOTE_APPROVED) {
      await this.partsFlow.consumeReservedParts(otId, performedByUserId);
    }

    if (targetStatus === OTStatus.CANCELLED) {
      await this.partsFlow.releaseReservationsForOrder(otId);
    }

    if (
      targetStatus === OTStatus.READY
      && ot.status === OTStatus.QC_PENDING
      && data.partsReconciliation?.length
    ) {
      await this.partsFlow.reconcilePartsAtQc(otId, performedByUserId, data.partsReconciliation);
    }

    // 5. Audit (fire-and-forget — pas bloquant)
    this.audit.log({
      entityType: 'ServiceOrder',
      entityId: otId,
      action: 'STATUS_CHANGE',
      performedBy: performedByUserId,
      before: { status: ot.status },
      after: { status: targetStatus },
      metadata: { reason: data.reason, automated: options?.automated ?? false },
    });

    // 6. SMS + notification in-app si READY
    if (targetStatus === OTStatus.READY) {
      const customer = await this.prisma.customer.findUnique({
        where: { id: ot.customerId },
        select: { phonePrimary: true, firstName: true, lastName: true, lang: true, id: true },
      });

      if (customer?.phonePrimary) {
        const nom = [customer.firstName, customer.lastName].filter(Boolean).join(' ');
        setImmediate(async () => {
          try {
            await this.smsQueue.add('vehicle_ready', {
              phone: customer.phonePrimary,
              message: `Bonjour ${nom}, votre véhicule est prêt. Vous pouvez venir le récupérer à l'atelier. Merci pour votre confiance.`,
              customerId: customer.id,
              lang: customer.lang ?? 'fr',
            });
            this.logger.log(`SMS "véhicule prêt" envoyé à ${customer.phonePrimary}`);
          } catch (err) {
            this.logger.error(`Échec SMS véhicule prêt pour OT ${otId}`, err);
          }
        });
      }

      // Notification in-app — réceptionniste ET caissier (deux envois distincts)
      setImmediate(async () => {
        try {
          const plate = ot.vehicle?.plateNumber ?? updatedOT.vehicleId;
          const clientName = customer
            ? [customer.firstName, customer.lastName].filter(Boolean).join(' ')
            : 'le client';

          const [receptionIds, caissierIds] = await Promise.all([
            this.notifications.getUserIdsByRoles(['RECEPTIONNISTE']),
            this.notifications.getUserIdsByRoles(['CAISSIER']),
          ]);

          if (receptionIds.length > 0) {
            await this.notifications.createInApp({
              recipientIds: receptionIds,
              title: 'Véhicule prêt à restituer',
              body: `${plate} — prévenir ${clientName} pour venir récupérer son véhicule.`,
              link: `/workshop/${otId}`,
              serviceOrderId: otId,
            });
          }

          if (caissierIds.length > 0) {
            await this.notifications.createInApp({
              recipientIds: caissierIds,
              title: 'Véhicule prêt — facturation',
              body: `${plate} — ${clientName} : véhicule prêt, facture à émettre.`,
              link: `/workshop/${otId}`,
              serviceOrderId: otId,
            });
          }
        } catch (err) {
          this.logger.error(`Échec notification in-app véhicule prêt pour OT ${otId}`, err);
        }
      });
    }

    // Notifier les caissiers quand une facture est émise
    if (targetStatus === OTStatus.INVOICED) {
      setImmediate(async () => {
        try {
          const recipientIds = await this.notifications.getUserIdsByRoles(['CAISSIER']);
          if (recipientIds.length === 0) return;
          const plate = ot.vehicle?.plateNumber ?? updatedOT.vehicleId;
          await this.notifications.createInApp({
            recipientIds,
            title: 'Facture à encaisser',
            body: `La facture pour le véhicule ${plate} est prête à être encaissée.`,
            link: `/workshop/${otId}`,
            serviceOrderId: otId,
          });
        } catch (err) {
          this.logger.error(`Échec notification INVOICED pour OT ${otId}`, err);
        }
      });
    }

    // OT clôturé (manuel ou auto) → informer réception, chef, admin + technicien assigné
    if (targetStatus === OTStatus.CLOSED) {
      setImmediate(async () => {
        try {
          const byRoleIds = await this.notifications.getUserIdsByRoles([
            'RECEPTIONNISTE',
            'CHEF_ATELIER',
            'ADMIN',
            'SUPER_ADMIN',
          ]);
          const recipientIds = [
            ...byRoleIds,
            ...(ot.assignedChef ? [ot.assignedChef] : []),
          ]
            .filter((id, index, arr) => arr.indexOf(id) === index)
            .filter((id) => id !== performedByUserId);
          if (recipientIds.length === 0) return;

          const plate = ot.vehicle?.plateNumber ?? ot.vehicleId;
          await this.notifications.createInApp({
            recipientIds,
            title: 'OT clôturé',
            body: `${plate} — dossier clôturé après encaissement total.`,
            link: `/workshop/${otId}`,
            serviceOrderId: otId,
          });
        } catch (err) {
          this.logger.error(`Échec notification CLOSED pour OT ${otId}`, err);
        }
      });
    }

    // Technicien assigné démarre les travaux → alerte chef + admin
    if (targetStatus === OTStatus.IN_PROGRESS && ot.status === OTStatus.QUOTE_APPROVED) {
      setImmediate(async () => {
        try {
          const byRoleIds = await this.notifications.getUserIdsByRoles([
            'CHEF_ATELIER', 'ADMIN', 'SUPER_ADMIN',
          ]);
          const recipientIds = byRoleIds.filter((id) => id !== performedByUserId);
          if (recipientIds.length === 0) return;

          const [performer, vehicle] = await Promise.all([
            this.prisma.user.findUnique({
              where: { id: performedByUserId },
              select: { firstName: true, lastName: true },
            }),
            ot.vehicle?.plateNumber
              ? Promise.resolve(ot.vehicle)
              : this.prisma.vehicle.findUnique({
                  where: { id: ot.vehicleId },
                  select: { plateNumber: true },
                }),
          ]);
          const techName = performer
            ? [performer.firstName, performer.lastName].filter(Boolean).join(' ')
            : 'Un technicien';
          const plate = vehicle?.plateNumber ?? ot.vehicleId;

          await this.notifications.createInApp({
            recipientIds,
            title: 'Travaux démarrés',
            body: `${techName} a lancé les travaux sur le véhicule ${plate}.`,
            link: `/workshop/${otId}`,
            serviceOrderId: otId,
          });
        } catch (err) {
          this.logger.error(`Échec notification démarrage travaux OT ${otId}`, err);
        }
      });
    }

    // Technicien soumet au contrôle qualité → alerte chef + admin
    if (targetStatus === OTStatus.QC_PENDING && ot.status === OTStatus.IN_PROGRESS) {
      setImmediate(async () => {
        try {
          const recipientIds = (
            await this.notifications.getUserIdsByRoles(['CHEF_ATELIER', 'ADMIN', 'SUPER_ADMIN'])
          ).filter((id) => id !== performedByUserId);
          if (recipientIds.length === 0) return;

          const plate = ot.vehicle?.plateNumber ?? ot.vehicleId;
          await this.notifications.createInApp({
            recipientIds,
            title: 'OT soumis au contrôle qualité',
            body: `${plate} en attente de validation.`,
            link: `/workshop/${otId}`,
            serviceOrderId: otId,
          });
        } catch (err) {
          this.logger.error(`Échec notification soumission QC OT ${otId}`, err);
        }
      });
    }

    // Contrôle qualité validé → technicien assigné (QC_PENDING ou QC_DONE legacy → READY)
    if (
      targetStatus === OTStatus.READY
      && (ot.status === OTStatus.QC_PENDING || ot.status === OTStatus.QC_DONE)
      && ot.assignedChef
      && ot.assignedChef !== performedByUserId
    ) {
      setImmediate(async () => {
        try {
          const plate = ot.vehicle?.plateNumber ?? ot.vehicleId;
          await this.notifications.createInApp({
            recipientIds: [ot.assignedChef!],
            title: 'Contrôle qualité validé',
            body: `Vos travaux sur ${plate} ont été validés. Le véhicule est prêt.`,
            link: `/workshop/${otId}`,
            serviceOrderId: otId,
          });
        } catch (err) {
          this.logger.error(`Échec notification validation QC OT ${otId}`, err);
        }
      });
    }

    // Contrôle qualité refusé → technicien assigné + admin (chaque retour, y compris n-ième)
    if (targetStatus === OTStatus.QC_REJECTED && ot.status === OTStatus.QC_PENDING) {
      setImmediate(async () => {
        try {
          const plate = ot.vehicle?.plateNumber ?? ot.vehicleId;
          const motif = data.reason?.trim();

          const adminIds = (
            await this.notifications.getUserIdsByRoles(['ADMIN', 'SUPER_ADMIN'])
          ).filter((id) => id !== performedByUserId);

          const recipientIds = [
            ...(ot.assignedChef ? [ot.assignedChef] : []),
            ...adminIds,
          ].filter((id, index, arr) => arr.indexOf(id) === index);

          if (recipientIds.length === 0) return;

          const rejectionRound = await this.prisma.oTStatusHistory.count({
            where: { serviceOrderId: otId, toStatus: OTStatus.QC_REJECTED },
          });
          const roundSuffix = rejectionRound > 1 ? ` (#${rejectionRound})` : '';

          await this.notifications.createInApp({
            recipientIds,
            title: `Contrôle qualité refusé${roundSuffix}`,
            body: motif
              ? `Reprendre les travaux sur ${plate}. Motif : ${motif}`
              : `Reprendre les travaux sur ${plate}.`,
            link: `/workshop/${otId}`,
            serviceOrderId: otId,
          });
        } catch (err) {
          this.logger.error(`Échec notification refus QC OT ${otId}`, err);
        }
      });
    }

    // Technicien reprend les travaux après refus CQ → alerte chef + admin
    if (targetStatus === OTStatus.IN_PROGRESS && ot.status === OTStatus.QC_REJECTED) {
      setImmediate(async () => {
        try {
          const recipientIds = (
            await this.notifications.getUserIdsByRoles(['CHEF_ATELIER', 'ADMIN', 'SUPER_ADMIN'])
          ).filter((id) => id !== performedByUserId);
          if (recipientIds.length === 0) return;

          const [performer, vehicle] = await Promise.all([
            this.prisma.user.findUnique({
              where: { id: performedByUserId },
              select: { firstName: true, lastName: true },
            }),
            ot.vehicle?.plateNumber
              ? Promise.resolve(ot.vehicle)
              : this.prisma.vehicle.findUnique({
                  where: { id: ot.vehicleId },
                  select: { plateNumber: true },
                }),
          ]);
          const techName = performer
            ? [performer.firstName, performer.lastName].filter(Boolean).join(' ')
            : 'Un technicien';
          const plate = vehicle?.plateNumber ?? ot.vehicleId;

          await this.notifications.createInApp({
            recipientIds,
            title: 'Travaux repris après refus CQ',
            body: `${techName} reprend les corrections sur ${plate}.`,
            link: `/workshop/${otId}`,
            serviceOrderId: otId,
          });
        } catch (err) {
          this.logger.error(`Échec notification reprise travaux OT ${otId}`, err);
        }
      });
    }

    this.events?.emitToRoles(
      ['CHEF_ATELIER', 'TECHNICIEN', 'RECEPTIONNISTE', 'CAISSIER', 'ADMIN', 'SUPER_ADMIN'],
      { type: 'ot.status_changed', otId, status: targetStatus },
    );

    return updatedOT;
  }

  async updateOT(id: string, data: UpdateOTDto) {
    const ot = await this.getOT(id);
    if (ot.status !== OTStatus.DRAFT) {
      throw new BadRequestException('Seuls les OT en brouillon peuvent être modifiés (ORD-007)');
    }
    return this.prisma.serviceOrder.update({
      where: { id },
      data: {
        ...(data.clientComplaint !== undefined && { clientComplaint: data.clientComplaint }),
        ...(data.priority        !== undefined && { priority: data.priority as any }),
        ...(data.mileageIn       !== undefined && { mileageIn: data.mileageIn }),
        ...(data.promisedAt      !== undefined && { promisedAt: new Date(data.promisedAt) }),
        ...(data.vehicleId       !== undefined && { vehicleId: data.vehicleId }),
        ...(data.customerId      !== undefined && { customerId: data.customerId }),
      },
    });
  }
}
