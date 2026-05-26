
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) { }

  /**
   * Log d'audit "Fire-and-forget" pour ne pas bloquer le thread principal (BASE)
   */
  log(record: {
    entityType: string;
    entityId: string;
    action: string;
    performedBy: string;
    before?: any;
    after?: any;
    metadata?: any;
  }) {
    setImmediate(async () => {
      try {
        const fieldChanges = this.buildDiff(record.before, record.after);

        await this.prisma.auditLog.create({
          data: {
            entityType: record.entityType,
            entityId: record.entityId,
            action: record.action,
            performedBy: record.performedBy,
            fieldChanges: fieldChanges as any,
            metadata: record.metadata || {},
            performedAt: new Date(),
          },
        });
      } catch (error) {
        this.logger.error(`Erreur d'audit pour ${record.entityType}:${record.entityId}`, error);
      }
    });
  }

  async getLogs(query: { limit?: number; offset?: number; entityType?: string; entityId?: string; performedBy?: string; action?: string }) {
    const where: any = {};
    if (query.entityType) where.entityType = query.entityType;
    if (query.entityId) where.entityId = query.entityId;
    if (query.performedBy) where.performedBy = query.performedBy;
    if (query.action) where.action = query.action;

    return this.prisma.auditLog.findMany({
      where,
      include: {
        performer: { select: { firstName: true, lastName: true } },
      },
      orderBy: { performedAt: 'desc' },
      take: query.limit ?? 50,
      skip: query.offset ?? 0,
    });
  }

  /**
   * Calcule la différence entre deux objets pour identifier les champs modifiés
   */
  private buildDiff(before: any, after: any): any {
    if (!before) return { _new: after };
    if (!after) return { _deleted: before };

    const changes: any = {};
    const allKeys = new Set([...Object.keys(before), ...Object.keys(after)]);

    for (const key of allKeys) {
      // Ignorer les champs techniques de date
      if (['updatedAt', 'updated_at', 'createdAt', 'created_at'].includes(key)) continue;

      const valBefore = before[key];
      const valAfter = after[key];

      if (JSON.stringify(valBefore) !== JSON.stringify(valAfter)) {
        changes[key] = {
          from: valBefore,
          to: valAfter,
        };
      }
    }

    return Object.keys(changes).length > 0 ? changes : null;
  }
}
