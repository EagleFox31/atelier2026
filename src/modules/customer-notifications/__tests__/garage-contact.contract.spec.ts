import request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { ClientIpThrottlerGuard } from '../../../shared/security/client-ip-throttler.guard';
import { generateOpaqueToken } from '../../../shared/security/opaque-token';
import { createTestApp, makeIntegrationPrismaMock } from '../../../__tests__/integration/helpers/app.helper';
import { GarageContactController } from '../garage-contact.controller';
import { GarageContactService } from '../garage-contact.service';

describe('GET public/garage-contact — HTTP contract', () => {
  let app: INestApplication;
  const p = {
    ...makeIntegrationPrismaMock(),
    garageContactLink: { findUnique: jest.fn() },
  };
  const raw = generateOpaqueToken();

  beforeAll(async () => {
    ({ app } = await createTestApp({
      moduleImports: [ThrottlerModule.forRoot([{ name: 'default', ttl: 60_000, limit: 1000 }])],
      controllers: [GarageContactController],
      extraProviders: [
        { provide: APP_GUARD, useClass: ClientIpThrottlerGuard },
        GarageContactService,
      ],
      prismaOverride: p,
    }));
  });
  afterAll(async () => { await app.close(); });

  it('returns contact for the authorized garage and no invoice/customer fields', async () => {
    p.garageContactLink.findUnique.mockResolvedValue({
      expiresAt: new Date(Date.now() + 60_000),
      revokedAt: null,
      garage: {
        name: 'Garage Akwa', status: 'active', phone: '690000001',
        city: 'Douala', address: 'Akwa',
      },
    });
    const r = await request(app.getHttpServer()).get(`/api/public/garage-contact/${raw}`);
    expect(r.status).toBe(200);
    expect(r.headers['cache-control']).toContain('no-store');
    expect(r.body).toEqual({
      garageName:'Garage Akwa', city:'Douala', address:'Akwa',
      phone:'690000001', dialNumber:'690000001',
    });
  });

  it('rejects an unknown link without authentication and never returns another garage', async () => {
    p.garageContactLink.findUnique.mockResolvedValue(null);
    const r = await request(app.getHttpServer()).get(`/api/public/garage-contact/${raw}`);
    expect(r.status).toBe(404);
    expect(r.body.errorCode).toBe('GARAGE_CONTACT_INVALID');
  });
});
