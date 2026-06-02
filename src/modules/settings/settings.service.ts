import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { UpdateWorkshopSettingsDto } from './dto/workshop-settings.dto';
import { requireGarageId } from '../../shared/garage/garage-scope';

export const DEFAULT_WORKSHOP_SETTINGS = {
  id: 'default',
  shopName: 'Atelier Maître',
  tagline: 'Garage automobile — Yaoundé, Cameroun',
  niu: 'M012345678901X',
  email: 'contact@atelier2026.cm',
  phone: '+237 699 00 00 00',
  address: 'Bastos, Rue 1.042, Yaoundé, Cameroun',
  defaultLaborRateXaf: 15000,
  taxRatePct: 19.25,
} as const;

function toResponse(row: {
  shopName: string;
  tagline: string;
  niu: string | null;
  email: string;
  phone: string;
  address: string;
  logoUrl?: string | null;
  defaultLaborRateXaf: { toNumber(): number } | null;
  taxRatePct: { toNumber(): number };
  updatedAt: Date;
}) {
  return {
    shopName: row.shopName,
    tagline: row.tagline,
    niu: row.niu,
    email: row.email,
    phone: row.phone,
    address: row.address,
    logoUrl: row.logoUrl ?? null,
    defaultLaborRateXaf: row.defaultLaborRateXaf?.toNumber() ?? null,
    taxRatePct: row.taxRatePct.toNumber(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

@Injectable()
export class SettingsService {
  constructor(private readonly prisma: PrismaService) {}

  async getWorkshopSettings(garageId?: string | null) {
    const row = await this.resolveSettings(garageId);
    return toResponse(row);
  }

  async updateWorkshopSettings(body: UpdateWorkshopSettingsDto, userId: string, garageId?: string | null) {
    const g = requireGarageId(garageId);
    const settingsId = `garage_${g}`;
    const row = await this.prisma.workshopSettings.upsert({
      where: { id: settingsId },
      create: {
        ...DEFAULT_WORKSHOP_SETTINGS,
        id: settingsId,
        garageId: g,
        shopName: body.shopName,
        tagline: body.tagline ?? DEFAULT_WORKSHOP_SETTINGS.tagline,
        niu: body.niu ?? null,
        email: body.email,
        phone: body.phone,
        address: body.address,
        defaultLaborRateXaf: body.defaultLaborRateXaf ?? DEFAULT_WORKSHOP_SETTINGS.defaultLaborRateXaf,
        taxRatePct: body.taxRatePct ?? DEFAULT_WORKSHOP_SETTINGS.taxRatePct,
        updatedById: userId,
      },
      update: {
        shopName: body.shopName,
        tagline: body.tagline,
        niu: body.niu ?? null,
        email: body.email,
        phone: body.phone,
        address: body.address,
        ...(body.defaultLaborRateXaf != null ? { defaultLaborRateXaf: body.defaultLaborRateXaf } : {}),
        ...(body.taxRatePct != null ? { taxRatePct: body.taxRatePct } : {}),
        updatedById: userId,
      },
    });
    return toResponse(row);
  }

  async updateLogo(logoUrl: string | null, userId: string, garageId?: string | null) {
    const g = requireGarageId(garageId);
    const settingsId = `garage_${g}`;
    const existing = await this.resolveSettings(garageId);
    return toResponse(
      await this.prisma.workshopSettings.upsert({
        where: { id: existing?.id ?? settingsId },
        create: { ...DEFAULT_WORKSHOP_SETTINGS, id: settingsId, garageId: g, logoUrl, updatedById: userId },
        update: { logoUrl, updatedById: userId },
      }),
    );
  }

  /** Settings du garage connecté — création auto au premier accès si absent. */
  private async resolveSettings(garageId?: string | null) {
    const g = requireGarageId(garageId);
    const existing = await this.prisma.workshopSettings.findFirst({
      where: { garageId: g },
    });
    if (existing) return existing;

    return this.prisma.workshopSettings.create({
      data: {
        ...DEFAULT_WORKSHOP_SETTINGS,
        id: `garage_${g}`,
        garageId: g,
        updatedById: null,
      },
    });
  }
}
