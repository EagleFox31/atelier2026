import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { Prisma, type CustomerNotificationEvent } from '@prisma/client';
import { Queue } from 'bullmq';
import { PrismaService } from '../../shared/prisma/prisma.service';
import {
  NOTIFICATION_CATALOG,
  orderedTemplateVariables,
  type NotificationVariable,
} from './customer-notification-catalog';
import { customerDisplayName } from './notification-format';
import {
  CUSTOMER_NOTIFICATIONS_QUEUE,
  DISPATCH_JOB,
  dispatchJobOptions,
  type DispatchJobData,
} from './customer-notifications.queue';
import { NotificationPreferencesService } from './notification-preferences.service';

export type CustomerNotificationInput = {
  /** `null` (données antérieures au multi-garage) : événement ignoré et journalisé. */
  garageId: string | null | undefined;
  eventType: CustomerNotificationEvent;
  /** Construite avec `notificationKeys`, jamais à la main. */
  idempotencyKey: string;
  customerId: string;
  refs?: {
    serviceOrderId?: string;
    appointmentId?: string;
    quoteId?: string;
    invoiceId?: string;
    paymentId?: string;
  };
  variables: Partial<Record<NotificationVariable, string>>;
};

export type EmitResult =
  | { outcome: 'IGNORED_NO_GARAGE' | 'DISABLED_BY_GARAGE' }
  | { outcome: 'QUEUED' | 'ALREADY_EXISTS'; notificationId: string };

/**
 * Point d'entrée des services métier, appelé APRÈS l'écriture métier.
 *
 * La ligne `customer_notifications` (outbox) est la source de vérité : elle est
 * écrite d'abord, de façon idempotente (garage, clé), puis la notification est
 * mise en file. Si Redis est indisponible, le balayeur la réenfile plus tard.
 */
@Injectable()
export class CustomerNotificationEmitter {
  private readonly logger = new Logger(CustomerNotificationEmitter.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly preferences: NotificationPreferencesService,
    @InjectQueue(CUSTOMER_NOTIFICATIONS_QUEUE) private readonly queue: Queue<DispatchJobData>,
  ) {}

  async emit(input: CustomerNotificationInput): Promise<EmitResult> {
    const { garageId, eventType, idempotencyKey } = input;
    if (!garageId) {
      this.logger.warn(`Notification ${eventType} ignorée : objet sans garage (${idempotencyKey}).`);
      return { outcome: 'IGNORED_NO_GARAGE' };
    }
    if (!(await this.preferences.isEnabled(garageId, eventType))) {
      return { outcome: 'DISABLED_BY_GARAGE' };
    }

    const variables = await this.withCommonVariables(garageId, input);
    // Échec immédiat si l'émetteur oublie une variable du modèle.
    orderedTemplateVariables(eventType, variables);

    const { row, created } = await this.insertOnce(garageId, { ...input, variables });
    if (row.status === 'PENDING') {
      await this.enqueue(row.id);
    }
    return { outcome: created ? 'QUEUED' : 'ALREADY_EXISTS', notificationId: row.id };
  }

  /** Variante pour les services métier : ne fait jamais échouer l'opération appelante. */
  async emitSafely(input: CustomerNotificationInput): Promise<EmitResult | null> {
    try {
      return await this.emit(input);
    } catch (error) {
      this.logger.error(
        `Notification ${input.eventType} non émise (${input.idempotencyKey})`,
        error instanceof Error ? error.stack : String(error),
      );
      return null;
    }
  }

  /**
   * Pour les services métier : construit et émet la notification sans retarder
   * ni faire échouer la réponse. `build` renvoie `null` quand il n'y a rien à émettre.
   */
  emitInBackground(label: string, build: () => Promise<CustomerNotificationInput | null>): void {
    void build()
      .then((input) => (input ? this.emitSafely(input) : null))
      .catch((error) =>
        this.logger.error(`Notification ${label} non construite`, error instanceof Error ? error.stack : String(error)),
      );
  }

  /** Mise en file idempotente (`jobId` déterministe) ; Redis absent = rattrapé par le balayeur. */
  async enqueue(notificationId: string): Promise<boolean> {
    try {
      await this.queue.add(DISPATCH_JOB, { notificationId }, dispatchJobOptions(notificationId));
      return true;
    } catch (error) {
      this.logger.warn(
        `Notification ${notificationId} non mise en file (reprise par le balayeur) : ${error instanceof Error ? error.message : String(error)}`,
      );
      return false;
    }
  }

  /**
   * Complète `customerName` et `garageName` quand le modèle les demande et que
   * l'appelant ne les a pas fournis : un seul endroit pour les lire.
   */
  private async withCommonVariables(
    garageId: string,
    input: CustomerNotificationInput,
  ): Promise<Partial<Record<NotificationVariable, string>>> {
    const needed = NOTIFICATION_CATALOG[input.eventType].variables;
    const variables = { ...input.variables };

    if (needed.includes('customerName') && !variables.customerName) {
      const customer = await this.prisma.customer.findFirst({
        where: { id: input.customerId, garageId },
        select: { customerType: true, companyName: true, firstName: true, lastName: true },
      });
      if (customer) variables.customerName = customerDisplayName(customer);
    }
    if (needed.includes('garageName') && !variables.garageName) {
      const [settings, garage] = await Promise.all([
        this.prisma.workshopSettings.findUnique({ where: { garageId }, select: { shopName: true } }),
        this.prisma.garage.findUnique({ where: { id: garageId }, select: { name: true } }),
      ]);
      const name = settings?.shopName?.trim() || garage?.name?.trim();
      if (name) variables.garageName = name;
    }
    return variables;
  }

  private async insertOnce(
    garageId: string,
    input: CustomerNotificationInput,
  ): Promise<{ row: { id: string; status: string }; created: boolean }> {
    const where = { garageId_idempotencyKey: { garageId, idempotencyKey: input.idempotencyKey } };
    const select = { id: true, status: true } as const;

    const existing = await this.prisma.customerNotification.findUnique({ where, select });
    if (existing) return { row: existing, created: false };

    try {
      const row = await this.prisma.customerNotification.create({
        data: {
          garageId,
          customerId: input.customerId,
          eventType: input.eventType,
          idempotencyKey: input.idempotencyKey,
          ...input.refs,
          variables: input.variables as Prisma.InputJsonObject,
        },
        select,
      });
      return { row, created: true };
    } catch (error) {
      // Émission concurrente de la même clé : l'autre écriture a gagné.
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        const row = await this.prisma.customerNotification.findUnique({ where, select });
        if (row) return { row, created: false };
      }
      throw error;
    }
  }
}
