
import { Injectable, OnModuleInit, Logger, NotFoundException } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import {
  SOFT_DELETE_MODELS,
  hideDeleted,
  redirectToSoftUpdate,
  withNotDeleted,
  type SoftDeleteRow,
} from './prisma-soft-delete.helpers';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    const adapter = new PrismaPg(pool);

    super({
      adapter,
      log: [
        { emit: 'event', level: 'query' },
        { emit: 'stdout', level: 'info' },
        { emit: 'stdout', level: 'warn' },
        { emit: 'stdout', level: 'error' },
      ],
    });

    const slowThreshold = process.env.NODE_ENV === 'production' ? 500 : 2000;
    (this as PrismaClient & { $on(event: 'query', cb: (e: { duration: number; query: string }) => void): void }).$on(
      'query',
      (e) => {
        if (e.duration > slowThreshold) {
          this.logger.warn(`Query lente (${e.duration}ms): ${e.query}`);
        }
      },
    );

    const extended = this.$extends({
      query: {
        $allModels: {
          async findMany({ model, args, query }) {
            return query(withNotDeleted(model, args));
          },
          async findFirst({ model, args, query }) {
            return query(withNotDeleted(model, args));
          },
          async findUnique({ model, args, query }) {
            const row = await query(args);
            return hideDeleted(model, row as SoftDeleteRow | null);
          },
          async findUniqueOrThrow({ model, args, query }) {
            const row = await query(args);
            if (SOFT_DELETE_MODELS.has(model) && row && (row as SoftDeleteRow).deletedAt != null) {
              throw new NotFoundException(`Enregistrement ${model} supprimé ou introuvable`);
            }
            return row;
          },
          async count({ model, args, query }) {
            return query(withNotDeleted(model, args));
          },
          async update({ model, args, query }) {
            return query(withNotDeleted(model, args));
          },
          async updateMany({ model, args, query }) {
            return query(withNotDeleted(model, args));
          },
          async delete({ model, args, query }) {
            if (!SOFT_DELETE_MODELS.has(model)) {
              return query(args);
            }
            return redirectToSoftUpdate(query, model, 'update', args);
          },
          async deleteMany({ model, args, query }) {
            if (!SOFT_DELETE_MODELS.has(model)) {
              return query(args);
            }
            return redirectToSoftUpdate(query, model, 'updateMany', args);
          },
        },
      },
      model: {
        $allModels: {
          async softDelete<T>(this: T, args: { where: Record<string, unknown> }): Promise<unknown> {
            const ctx = this as { update: (a: unknown) => Promise<unknown> };
            return ctx.update({ where: args.where, data: { deletedAt: new Date() } });
          },
          async softDeleteMany<T>(this: T, args: { where: Record<string, unknown> }): Promise<unknown> {
            const ctx = this as { updateMany: (a: unknown) => Promise<unknown> };
            return ctx.updateMany({ where: args.where, data: { deletedAt: new Date() } });
          },
        },
      },
    });

    return extended as unknown as PrismaService;
  }

  async onModuleInit() {
    await this.$connect();
  }

  async transaction<T>(fn: (prisma: PrismaClient) => Promise<T>): Promise<T> {
    return this.$transaction(fn as any) as Promise<T>;
  }

  /**
   * Retourne un client Prisma étendu qui :
   * - filtre automatiquement toutes les lectures par garageId
   * - injecte garageId sur tous les create
   * Usage : const db = this.prisma.forGarage(user.garageId); db.customer.findMany(...)
   */
  forGarage(garageId: string | null | undefined) {
    if (!garageId) return this;

    const SCOPED: Record<string, true> = {
      customer: true, vehicle: true, serviceOrder: true, partsCatalog: true,
      stockMovement: true, quote: true, invoice: true, payment: true, appointment: true,
    };

    return this.$extends({
      query: {
        $allModels: {
          async findMany({ model, args, query }: any) {
            if (SCOPED[model.charAt(0).toLowerCase() + model.slice(1)]) {
              args.where = { ...args.where, garageId };
            }
            return query(args);
          },
          async findFirst({ model, args, query }: any) {
            if (SCOPED[model.charAt(0).toLowerCase() + model.slice(1)]) {
              args.where = { ...args.where, garageId };
            }
            return query(args);
          },
          async count({ model, args, query }: any) {
            if (SCOPED[model.charAt(0).toLowerCase() + model.slice(1)]) {
              args.where = { ...args.where, garageId };
            }
            return query(args);
          },
          async create({ model, args, query }: any) {
            if (SCOPED[model.charAt(0).toLowerCase() + model.slice(1)]) {
              (args.data as any).garageId = (args.data as any).garageId ?? garageId;
            }
            return query(args);
          },
          async createMany({ model, args, query }: any) {
            if (SCOPED[model.charAt(0).toLowerCase() + model.slice(1)]) {
              const data = Array.isArray(args.data) ? args.data : [args.data];
              args.data = data.map((d: any) => ({ ...d, garageId: d.garageId ?? garageId }));
            }
            return query(args);
          },
        },
      },
    }) as unknown as PrismaService;
  }
}
