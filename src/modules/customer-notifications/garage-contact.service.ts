import { GoneException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { hashOpaqueToken, isWellFormedOpaqueToken } from '../../shared/security/opaque-token';

const invalid = () => new NotFoundException({
  errorCode: 'GARAGE_CONTACT_INVALID',
  message: 'Ce lien de contact est invalide ou le garage est indisponible.',
});
const expired = () => new GoneException({
  errorCode: 'GARAGE_CONTACT_EXPIRED',
  message: 'Ce lien de contact a expiré. Demandez un nouveau message à votre garage.',
});

/** A token is scoped to exactly one garage, and yields no customer or invoice fields. */
@Injectable()
export class GarageContactService {
  constructor(private readonly prisma: PrismaService) {}

  async describe(token: string, now: Date = new Date()) {
    if (!isWellFormedOpaqueToken(token)) throw invalid();
    const access = await this.prisma.garageContactLink.findUnique({
      where: { tokenHash: hashOpaqueToken(token) },
      include: { garage: { select: {
        name: true, phone: true, city: true, address: true, status: true,
      } } },
    });
    if (!access || !access.garage || access.garage.status !== 'active') throw invalid();
    if (access.revokedAt || access.expiresAt <= now) throw expired();
    const phone = access.garage.phone.trim();
    // Only reveal dialable business numbers; no user or customer phone ever leaves this endpoint.
    if (!/^\+?[0-9\s().-]{8,25}$/.test(phone)) throw invalid();
    const dialNumber = phone.replace(/[^\d+]/g, '');
    if (!/^\+?[0-9]{8,15}$/.test(dialNumber)) throw invalid();
    return {
      garageName: access.garage.name,
      city: access.garage.city,
      address: access.garage.address,
      phone,
      dialNumber,
    };
  }
}
