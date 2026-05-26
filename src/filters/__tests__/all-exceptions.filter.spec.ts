import { HttpException, HttpStatus, ArgumentsHost } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AllExceptionsFilter } from '../all-exceptions.filter';

// ─── Helper : fabrique un ArgumentsHost minimal ───────────────────────────────

function makeHost(method = 'POST', url = '/api/test') {
  const json = jest.fn();
  const statusFn = jest.fn().mockReturnValue({ json });
  return {
    host: {
      switchToHttp: () => ({
        getResponse: () => ({ status: statusFn }),
        getRequest: () => ({ method, url }),
      }),
    } as unknown as ArgumentsHost,
    statusFn,
    json,
  };
}

function getBody(json: jest.Mock) {
  return json.mock.calls[0][0] as Record<string, unknown>;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('AllExceptionsFilter', () => {
  let filter: AllExceptionsFilter;

  beforeEach(() => {
    filter = new AllExceptionsFilter();
  });

  // ── HttpException ────────────────────────────────────────────────────────────

  describe('HttpException', () => {
    it('propage le statusCode HTTP exact', () => {
      const { host, statusFn } = makeHost();
      filter.catch(new HttpException('Non trouvé', HttpStatus.NOT_FOUND), host);
      expect(statusFn).toHaveBeenCalledWith(404);
    });

    it('propage le message string directement', () => {
      const { host, json } = makeHost();
      filter.catch(new HttpException('Accès refusé', HttpStatus.FORBIDDEN), host);
      expect(getBody(json).message).toBe('Accès refusé');
    });

    it('propage le tableau de messages de validation (class-validator)', () => {
      const { host, json } = makeHost();
      const messages = ['email invalide', 'phone obligatoire'];
      filter.catch(
        new HttpException({ message: messages, error: 'Bad Request' }, HttpStatus.BAD_REQUEST),
        host,
      );
      expect(getBody(json).message).toEqual(messages);
    });

    it('inclut path et timestamp dans la réponse', () => {
      const { host, json } = makeHost('GET', '/api/customers');
      filter.catch(new HttpException('OK', 200), host);
      const body = getBody(json);
      expect(body.path).toBe('/api/customers');
      expect(body.timestamp).toBeDefined();
    });
  });

  // ── Erreurs Prisma ────────────────────────────────────────────────────────────

  describe('Prisma — PrismaClientKnownRequestError', () => {
    it('P2002 (contrainte unique) → 409 + errorCode DB_CONFLICT', () => {
      const { host, statusFn, json } = makeHost();
      const err = new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
        code: 'P2002',
        clientVersion: '7.7.0',
        meta: { target: ['email'] },
      });
      filter.catch(err, host);
      expect(statusFn).toHaveBeenCalledWith(409);
      expect(getBody(json).errorCode).toBe('DB_CONFLICT');
    });

    it('P2002 inclut le nom du champ en conflit dans le message', () => {
      const { host, json } = makeHost();
      const err = new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
        code: 'P2002',
        clientVersion: '7.7.0',
        meta: { target: ['email'] },
      });
      filter.catch(err, host);
      expect((getBody(json).message as string)).toContain('email');
    });

    it('P2025 (enregistrement introuvable) → 404 + errorCode DB_NOT_FOUND', () => {
      const { host, statusFn, json } = makeHost();
      const err = new Prisma.PrismaClientKnownRequestError('Record not found', {
        code: 'P2025',
        clientVersion: '7.7.0',
      });
      filter.catch(err, host);
      expect(statusFn).toHaveBeenCalledWith(404);
      expect(getBody(json).errorCode).toBe('DB_NOT_FOUND');
    });

    it('P2003 (clé étrangère invalide) → 400 + errorCode DB_FOREIGN_KEY', () => {
      const { host, statusFn, json } = makeHost();
      const err = new Prisma.PrismaClientKnownRequestError('Foreign key constraint failed', {
        code: 'P2003',
        clientVersion: '7.7.0',
      });
      filter.catch(err, host);
      expect(statusFn).toHaveBeenCalledWith(400);
      expect(getBody(json).errorCode).toBe('DB_FOREIGN_KEY');
    });

    it('P2022 (colonne manquante) → 503 + errorCode DB_SCHEMA_OUTDATED', () => {
      const { host, statusFn, json } = makeHost();
      const err = new Prisma.PrismaClientKnownRequestError('Column not found', {
        code: 'P2022',
        clientVersion: '7.7.0',
        meta: { column: 'users.onboarding_completed_at' },
      });
      filter.catch(err, host);
      expect(statusFn).toHaveBeenCalledWith(503);
      expect(getBody(json).errorCode).toBe('DB_SCHEMA_OUTDATED');
    });

    it('code Prisma inconnu → 400 + errorCode = le code Prisma', () => {
      const { host, statusFn, json } = makeHost();
      const err = new Prisma.PrismaClientKnownRequestError('Unknown Prisma error', {
        code: 'P2016',
        clientVersion: '7.7.0',
      });
      filter.catch(err, host);
      expect(statusFn).toHaveBeenCalledWith(400);
      expect(getBody(json).errorCode).toBe('P2016');
    });
  });

  describe('Prisma — PrismaClientValidationError', () => {
    it('données invalides envoyées à Prisma → 400 + errorCode DB_VALIDATION_ERROR', () => {
      const { host, statusFn, json } = makeHost();
      const err = new Prisma.PrismaClientValidationError('Validation failed', {
        clientVersion: '7.7.0',
      });
      filter.catch(err, host);
      expect(statusFn).toHaveBeenCalledWith(400);
      expect(getBody(json).errorCode).toBe('DB_VALIDATION_ERROR');
    });
  });

  describe('Prisma — PrismaClientInitializationError', () => {
    it('DB injoignable → 503 + errorCode DB_INIT_ERROR', () => {
      const { host, statusFn, json } = makeHost();
      const err = new Prisma.PrismaClientInitializationError('Connection refused', '7.7.0');
      filter.catch(err, host);
      expect(statusFn).toHaveBeenCalledWith(503);
      expect(getBody(json).errorCode).toBe('DB_INIT_ERROR');
    });
  });

  describe('Erreur JavaScript générique', () => {
    it('Error non gérée → 500', () => {
      const { host, statusFn } = makeHost();
      filter.catch(new Error('crash inattendu'), host);
      expect(statusFn).toHaveBeenCalledWith(500);
    });
  });
});
