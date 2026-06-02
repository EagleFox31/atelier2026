import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { AllExceptionsFilter } from '../../../filters/all-exceptions.filter';
import { JwtAuthGuard, PermissionsGuard } from '../../../guards/auth.guard';
import { PrismaService } from '../../../shared/prisma/prisma.service';
import { AuditService } from '../../../shared/audit/audit.service';
import { JwtSecretsService } from '../../../modules/auth/jwt-secrets.service';

// Même valeur que JwtSecretsService.DEV_FALLBACK_SECRET
// Utilisé quand JWT_SECRET n'est pas défini dans l'env — c'est le cas en tests
const TEST_JWT_SECRET = 'atelier-cm-dev-only-secret-do-not-use-in-prod';

/** Génère un JWT valide signé avec le secret fallback dev */
export function signTestToken(userId: string, version = 1): string {
  const jwtService = new JwtService();
  return jwtService.sign(
    { sub: userId, email: 'test@atelier.cm', version },
    { secret: TEST_JWT_SECRET, expiresIn: '1h' },
  );
}

/** Retourne un enregistrement User tel que PrismaService le retourne dans JwtAuthGuard */
export function makeDbUser(
  userId: string,
  roleCodes: string[],
  permCodes: string[],
  overrides: Record<string, unknown> = {},
) {
  return {
    id: userId,
    email: 'test@atelier.cm',
    status: 'ACTIVE',
    tokenVersion: 1,
    firstName: 'Test',
    lastName: 'User',
    roles: roleCodes.map((code) => ({
      role: {
        code,
        permissions: permCodes.map((pCode) => ({ permission: { code: pCode } })),
      },
    })),
    ...overrides,
  };
}

/** Mock Prisma minimal couvrant user (guard) + customer (service) + auditLog */
export function makeIntegrationPrismaMock() {
  return {
    user: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn().mockResolvedValue({}),
    },
    customer: {
      create: jest.fn(),
      findMany: jest.fn().mockResolvedValue([]),
      findUnique: jest.fn().mockResolvedValue(null),
      findFirst: jest.fn().mockResolvedValue(null),
      update: jest.fn(),
    },
    vehicle: {
      create: jest.fn(),
      findMany: jest.fn().mockResolvedValue([]),
      findUnique: jest.fn().mockResolvedValue(null),
      findFirst: jest.fn().mockResolvedValue(null),
      update: jest.fn(),
    },
    auditLog: {
      create: jest.fn().mockResolvedValue({}),
    },
  };
}

/**
 * Crée une application NestJS de test reproduisant fidèlement le middleware de production :
 *  - ValidationPipe (whitelist + forbidNonWhitelisted + transform)
 *  - AllExceptionsFilter
 *  - JwtAuthGuard + PermissionsGuard globaux
 *  - Préfixe /api
 *
 * N'importe PAS AuthModule directement pour éviter le conflit JwtModule.registerAsync.
 * À la place, JwtModule.register() statique + JwtSecretsService manuel.
 */
export async function createTestApp(options: {
  moduleImports?: any[];
  controllers?: any[];
  extraProviders?: any[];
  prismaOverride: ReturnType<typeof makeIntegrationPrismaMock>;
}): Promise<{ app: INestApplication; moduleRef: TestingModule }> {
  const { moduleImports = [], controllers = [], extraProviders = [], prismaOverride } = options;

  const moduleRef = await Test.createTestingModule({
    imports: [
      // JWT statique pour les tests — JwtSecretsService vérifie avec DEV_FALLBACK_SECRET de toute façon
      JwtModule.register({ secret: TEST_JWT_SECRET, global: true }),
      ...moduleImports,
    ],
    controllers,
    providers: [
      JwtSecretsService,
      { provide: PrismaService, useValue: prismaOverride },
      { provide: AuditService, useValue: { log: jest.fn(), getLogs: jest.fn() } },
      { provide: APP_GUARD, useClass: JwtAuthGuard },
      { provide: APP_GUARD, useClass: PermissionsGuard },
      ...extraProviders,
    ],
  })
    .overrideProvider(PrismaService)
    .useValue(prismaOverride)
    .compile();

  const app = moduleRef.createNestApplication();
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
  );
  app.useGlobalFilters(new AllExceptionsFilter());
  app.setGlobalPrefix('api');
  await app.init();

  return { app, moduleRef };
}
