import { ForbiddenException, NotFoundException } from '@nestjs/common';
import type { PrismaService } from '../prisma/prisma.service';

/** Garage obligatoire pour toute opération métier (sauf routes admin plateforme). */
export function requireGarageId(garageId: string | null | undefined): string {
  if (!garageId) {
    throw new ForbiddenException('Aucun garage associé à votre compte');
  }
  return garageId;
}

export function garageWhere(garageId: string | null | undefined): { garageId: string } {
  return { garageId: requireGarageId(garageId) };
}

/** Masque les IDOR : 404 si la ressource appartient à un autre garage. */
export function assertEntityGarage(
  entityGarageId: string | null | undefined,
  userGarageId: string | null | undefined,
): void {
  const g = requireGarageId(userGarageId);
  if (entityGarageId && entityGarageId !== g) {
    throw new NotFoundException('Ressource introuvable');
  }
}

export async function assertOTInGarage(
  prisma: PrismaService,
  otId: string,
  garageId: string | null | undefined,
): Promise<void> {
  const g = requireGarageId(garageId);
  const ot = await prisma.serviceOrder.findFirst({
    where: { id: otId, garageId: g },
    select: { id: true },
  });
  if (!ot) throw new NotFoundException('Ordre de travail introuvable');
}

export async function assertQuoteInGarage(
  prisma: PrismaService,
  quoteId: string,
  garageId: string | null | undefined,
): Promise<{ id: string; garageId: string | null; status: string }> {
  const g = requireGarageId(garageId);
  const quote = await prisma.quote.findFirst({
    where: { id: quoteId, garageId: g },
    select: { id: true, garageId: true, status: true },
  });
  if (!quote) throw new NotFoundException('Devis introuvable');
  return quote;
}

export async function assertInvoiceInGarage(
  prisma: PrismaService,
  invoiceId: string,
  garageId: string | null | undefined,
): Promise<{ id: string; garageId: string | null }> {
  const g = requireGarageId(garageId);
  const invoice = await prisma.invoice.findFirst({
    where: { id: invoiceId, garageId: g },
    select: { id: true, garageId: true },
  });
  if (!invoice) throw new NotFoundException('Facture introuvable');
  return invoice;
}

export async function assertPartInGarage(
  prisma: PrismaService,
  partId: string,
  garageId: string | null | undefined,
): Promise<void> {
  const g = requireGarageId(garageId);
  const part = await prisma.partsCatalog.findFirst({
    where: { id: partId, garageId: g },
    select: { id: true },
  });
  if (!part) throw new NotFoundException('Pièce introuvable');
}

export async function assertAppointmentInGarage(
  prisma: PrismaService,
  appointmentId: string,
  garageId: string | null | undefined,
): Promise<void> {
  const g = requireGarageId(garageId);
  const row = await prisma.appointment.findFirst({
    where: { id: appointmentId, garageId: g },
    select: { id: true },
  });
  if (!row) throw new NotFoundException('Rendez-vous introuvable');
}

export async function assertTeamMemberInGarage(
  prisma: PrismaService,
  userId: string,
  garageId: string | null | undefined,
): Promise<void> {
  const g = requireGarageId(garageId);
  const user = await prisma.user.findFirst({
    where: { id: userId, garageId: g, deletedAt: null },
    select: { id: true },
  });
  if (!user) throw new NotFoundException('Membre de l\'équipe introuvable');
}

export async function assertCustomerInGarage(
  prisma: PrismaService,
  customerId: string,
  garageId: string | null | undefined,
): Promise<void> {
  const g = requireGarageId(garageId);
  const row = await prisma.customer.findFirst({
    where: { id: customerId, garageId: g, deletedAt: null },
    select: { id: true },
  });
  if (!row) throw new NotFoundException('Client introuvable');
}

export async function assertVehicleInGarage(
  prisma: PrismaService,
  vehicleId: string,
  garageId: string | null | undefined,
): Promise<void> {
  const g = requireGarageId(garageId);
  const row = await prisma.vehicle.findFirst({
    where: { id: vehicleId, garageId: g, deletedAt: null },
    select: { id: true },
  });
  if (!row) throw new NotFoundException('Véhicule introuvable');
}
