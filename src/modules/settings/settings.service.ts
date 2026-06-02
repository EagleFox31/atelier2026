import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { UpdateWorkshopSettingsDto } from './dto/workshop-settings.dto';

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
    const settingsId = garageId ? `garage_${garageId}` : 'default';
    const row = await this.prisma.workshopSettings.upsert({
      where: { id: settingsId },
      create: {
        ...DEFAULT_WORKSHOP_SETTINGS,
        id: settingsId,
        ...(garageId ? { garageId } : {}),
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
    const settingsId = garageId ? `garage_${garageId}` : 'default';
    const existing = await this.resolveSettings(garageId);
    return toResponse(
      await this.prisma.workshopSettings.upsert({
        where: { id: existing?.id ?? settingsId },
        create: { ...DEFAULT_WORKSHOP_SETTINGS, id: settingsId, garageId: garageId ?? null, logoUrl, updatedById: userId },
        update: { logoUrl, updatedById: userId },
      }),
    );
  }

  /** Cherche les settings par garageId, fallback sur 'default' */
  private async resolveSettings(garageId?: string | null) {
    if (garageId) {
      const garageSettings = await this.prisma.workshopSettings.findFirst({
        where: { garageId },
      });
      if (garageSettings) return garageSettings;
    }

    const existing = await this.prisma.workshopSettings.findUnique({ where: { id: 'default' } });
    if (existing) return existing;

    return this.prisma.workshopSettings.create({
      data: { ...DEFAULT_WORKSHOP_SETTINGS, updatedById: null },
    });
  }
}
