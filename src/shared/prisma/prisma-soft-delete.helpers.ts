/** Modèles avec champ deletedAt — soft delete actif */
export const SOFT_DELETE_MODELS = new Set(['User', 'Customer', 'Vehicle']);

type SoftDeleteRow = { deletedAt?: Date | null };

export function withNotDeleted<T extends { where?: Record<string, unknown> }>(
  model: string,
  args: T,
): T {
  if (!SOFT_DELETE_MODELS.has(model)) return args;
  return { ...args, where: { ...args.where, deletedAt: null } };
}

export function hideDeleted<M extends string>(
  model: M,
  row: SoftDeleteRow | null,
): SoftDeleteRow | null {
  if (!row || !SOFT_DELETE_MODELS.has(model)) return row;
  return row.deletedAt != null ? null : row;
}

export function softDeleteData(model: string): Record<string, unknown> {
  if (model === 'User') {
    return { deletedAt: new Date(), status: 'DELETED' };
  }
  return { deletedAt: new Date() };
}

/** Redirige delete/deleteMany vers update — API interne Prisma $extends */
export function redirectToSoftUpdate(
  query: (params: unknown) => Promise<unknown>,
  model: string,
  operation: 'update' | 'updateMany',
  args: { where?: Record<string, unknown> },
): Promise<unknown> {
  return query({
    model,
    operation,
    args: { where: args.where, data: softDeleteData(model) },
  });
}

export type { SoftDeleteRow };
