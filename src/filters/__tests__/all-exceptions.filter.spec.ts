import { ArgumentsHost, ForbiddenException, HttpException, HttpStatus, Logger } from '@nestjs/common';
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

    it('conserve le errorCode métier et ses détails (contrat front, ex. TRIAL_READ_ONLY)', () => {
      const { host, json, statusFn } = makeHost();
      filter.catch(
        new ForbiddenException({
          message: 'Votre pilote est terminé.',
          errorCode: 'TRIAL_READ_ONLY',
          subscriptionStatus: 'GRACE_PERIOD',
        }),
        host,
      );
      const body = getBody(json);
      expect(statusFn).toHaveBeenCalledWith(403);
      expect(body.errorCode).toBe('TRIAL_READ_ONLY');
      expect(body.subscriptionStatus).toBe('GRACE_PERIOD');
      expect(body.message).toBe('Votre pilote est terminé.');
      expect(body.statusCode).toBe(403);
    });

    it('sans errorCode métier : comportement inchangé (libellé HTTP, sans champ parasite)', () => {
      const { host, json } = makeHost();
      filter.catch(new ForbiddenException('Accès refusé'), host);
      const body = getBody(json);
      expect(body.errorCode).toBe('Forbidden');
      expect(Object.keys(body).sort()).toEqual(['errorCode', 'message', 'path', 'statusCode', 'timestamp']);
    });

    it('un détail métier ne peut pas écraser statusCode / errorCode / message / path', () => {
      const { host, json } = makeHost();
      filter.catch(
        new HttpException({ message: 'm', errorCode: 'X', path: '/forge', timestamp: 'forge' }, 400),
        host,
      );
      const body = getBody(json);
      expect(body.errorCode).toBe('X');
      expect(body.path).toBe('/api/test');
      expect(body.timestamp).not.toBe('forge');
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

  describe('journalisation sans données personnelles', () => {
    let warnSpy: jest.SpyInstance;
    beforeEach(() => {
      warnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    });
    afterEach(() => warnSpy.mockRestore());

    const logged = () => warnSpy.mock.calls.map((call) => String(call[0])).join('\n');

    it('ne journalise pas la query string (ex. ?phone= de l’historique SMS)', () => {
      const { host } = makeHost('GET', '/api/notifications/sms/history?phone=699123456');
      filter.catch(new HttpException('Refusé', HttpStatus.BAD_REQUEST), host);
      expect(logged()).toContain('[GET /api/notifications/sms/history] 400');
      expect(logged()).not.toContain('699123456');
    });

    it('ne journalise que le motif d’une PrismaClientValidationError, pas les arguments', () => {
      const { host } = makeHost();
      const message = [
        'Invalid `prisma.sMSNotification.create()` invocation in',
        '/app/src/modules/notifications/notifications.service.ts:54:3',
        '',
        '→ 54 prisma.sMSNotification.create({',
        '       data: { phoneTo: "+237699123456", messageBody: "Bonjour Awa, votre véhicule est prêt" }',
        '     })',
        '',
        'Argument `garage` is missing.',
      ].join('\n');
      filter.catch(new Prisma.PrismaClientValidationError(message, { clientVersion: '7.7.0' }), host);
      expect(logged()).toContain('Argument `garage` is missing.');
      expect(logged()).not.toContain('699123456');
      expect(logged()).not.toContain('Bonjour Awa');
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
