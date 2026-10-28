import type { PrismaClient } from '@prisma/client';
import { generateOpaqueToken, hashOpaqueToken } from '../security/opaque-token';

/** A link reveals only the recipient garage's public contact information, never invoice/customer details. */
export const GARAGE_CONTACT_LINK_TTL_DAYS = 30;
type Client = Pick<PrismaClient, '$transaction' | 'garageContactLink'>;

export async function issueGarageContactToken(
  prisma: Client,
  input: { garageId: string; notificationId: string; now?: Date },
): Promise<string> {
  const now = input.now ?? new Date();
  const token = generateOpaqueToken();
  await prisma.$transaction([
    prisma.garageContactLink.updateMany({
      where: { notificationId: input.notificationId, revokedAt: null },
      data: { revokedAt: now },
    }),
    prisma.garageContactLink.create({
      data: {
        garageId: input.garageId,
        notificationId: input.notificationId,
        tokenHash: hashOpaqueToken(token),
        expiresAt: new Date(now.getTime() + GARAGE_CONTACT_LINK_TTL_DAYS * 86_400_000),
      },
    }),
  ]);
  return token;
}
