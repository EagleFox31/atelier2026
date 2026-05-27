import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PermissionsGuard } from '../auth.guard';
import { PERMISSIONS_KEY, ROLES_KEY } from '../../decorators/auth.decorator';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeUser(roleCodes: string[], permissionCodes: string[] = []) {
  return {
    roles: roleCodes.map((code) => ({
      role: {
        code,
        permissions: permissionCodes.map((pCode) => ({
          permission: { code: pCode },
        })),
      },
    })),
  };
}

function makeContext(user: object, requiredPermissions?: string[], requiredRoles?: string[]) {
  const reflector = new Reflector();
  jest.spyOn(reflector, 'getAllAndOverride').mockImplementation((key) => {
    if (key === PERMISSIONS_KEY) return requiredPermissions;
    if (key === ROLES_KEY) return requiredRoles;
    return undefined;
  });

  const mockContext = {
    getHandler: () => ({}),
    getClass: () => ({}),
    switchToHttp: () => ({
      getRequest: () => ({ user }),
    }),
  } as unknown as ExecutionContext;

  return { reflector, mockContext };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('PermissionsGuard', () => {
  describe('route sans restriction', () => {
    it('laisse passer si aucune permission ni rôle requis', () => {
      const { reflector, mockContext } = makeContext(makeUser(['TECHNICIEN']));
      const guard = new PermissionsGuard(reflector);
      expect(guard.canActivate(mockContext)).toBe(true);
    });
  });

  describe('bypass ADMIN / SUPER_ADMIN', () => {
    it('ADMIN passe toujours, même sans la permission requise', () => {
      const { reflector, mockContext } = makeContext(
        makeUser(['ADMIN'], []),          // ADMIN sans aucune permission explicite
        ['FAC_CREATE'],
      );
      const guard = new PermissionsGuard(reflector);
      expect(guard.canActivate(mockContext)).toBe(true);
    });

    it('SUPER_ADMIN passe toujours', () => {
      const { reflector, mockContext } = makeContext(
        makeUser(['SUPER_ADMIN']),
        ['STK_CREATE'],
      );
      const guard = new PermissionsGuard(reflector);
      expect(guard.canActivate(mockContext)).toBe(true);
    });
  });

  describe('contrôle par permissions', () => {
    it('autorise si l\'utilisateur possède la permission requise', () => {
      const { reflector, mockContext } = makeContext(
        makeUser(['CAISSIER'], ['FAC_CREATE']),
        ['FAC_CREATE'],
      );
      const guard = new PermissionsGuard(reflector);
      expect(guard.canActivate(mockContext)).toBe(true);
    });

    it('rejette si la permission est manquante', () => {
      const { reflector, mockContext } = makeContext(
        makeUser(['TECHNICIEN'], ['VEH_VIEW', 'ORD_VIEW']),
        ['FAC_CREATE'],          // TECHNICIEN n'a pas FAC_CREATE
      );
      const guard = new PermissionsGuard(reflector);
      expect(() => guard.canActivate(mockContext)).toThrow(ForbiddenException);
    });

    it('rejette si une seule permission sur plusieurs est manquante', () => {
      const { reflector, mockContext } = makeContext(
        makeUser(['RECEPTIONNISTE'], ['VEH_VIEW', 'VEH_CREATE']),
        ['VEH_VIEW', 'FAC_CREATE'],  // FAC_CREATE manquante
      );
      const guard = new PermissionsGuard(reflector);
      expect(() => guard.canActivate(mockContext)).toThrow(ForbiddenException);
    });

    it('autorise si toutes les permissions requises sont présentes', () => {
      const { reflector, mockContext } = makeContext(
        makeUser(['CHEF_ATELIER'], ['VEH_VIEW', 'ORD_CREATE', 'FAC_CREATE']),
        ['VEH_VIEW', 'ORD_CREATE'],
      );
      const guard = new PermissionsGuard(reflector);
      expect(guard.canActivate(mockContext)).toBe(true);
    });
  });

  describe('contrôle par rôles', () => {
    it('autorise si l\'utilisateur a le rôle requis', () => {
      const { reflector, mockContext } = makeContext(
        makeUser(['CHEF_ATELIER']),
        undefined,
        ['CHEF_ATELIER', 'ADMIN'],
      );
      const guard = new PermissionsGuard(reflector);
      expect(guard.canActivate(mockContext)).toBe(true);
    });

    it('rejette si le rôle ne correspond pas', () => {
      const { reflector, mockContext } = makeContext(
        makeUser(['TECHNICIEN']),
        undefined,
        ['CHEF_ATELIER', 'CAISSIER'],
      );
      const guard = new PermissionsGuard(reflector);
      expect(() => guard.canActivate(mockContext)).toThrow(ForbiddenException);
    });
  });

  describe('matrice RBAC projet — cas critiques', () => {
    const cases: { role: string; perms: string[]; required: string; allowed: boolean }[] = [
      // TECHNICIEN — lecture seule
      { role: 'TECHNICIEN', perms: ['VEH_VIEW', 'ORD_VIEW', 'STK_VIEW'], required: 'VEH_VIEW', allowed: true },
      { role: 'TECHNICIEN', perms: ['VEH_VIEW', 'ORD_VIEW', 'STK_VIEW'], required: 'FAC_CREATE', allowed: false },
      { role: 'TECHNICIEN', perms: ['VEH_VIEW', 'ORD_VIEW', 'STK_VIEW'], required: 'STK_CREATE', allowed: false },
      // CAISSIER — voir + encaisser, pas créer devis/factures
      { role: 'CAISSIER', perms: ['VEH_VIEW', 'ORD_VIEW', 'FAC_VIEW', 'FAC_PAY', 'STK_VIEW'], required: 'FAC_VIEW', allowed: true },
      { role: 'CAISSIER', perms: ['VEH_VIEW', 'ORD_VIEW', 'FAC_VIEW', 'FAC_PAY', 'STK_VIEW'], required: 'FAC_PAY', allowed: true },
      { role: 'CAISSIER', perms: ['VEH_VIEW', 'ORD_VIEW', 'FAC_VIEW', 'FAC_PAY', 'STK_VIEW'], required: 'FAC_CREATE', allowed: false },
      // RECEPTIONNISTE — accueil + consultation devis/factures, pas modifier
      { role: 'RECEPTIONNISTE', perms: ['VEH_VIEW', 'VEH_CREATE', 'ORD_VIEW', 'ORD_CREATE', 'FAC_VIEW'], required: 'ORD_CREATE', allowed: true },
      { role: 'RECEPTIONNISTE', perms: ['VEH_VIEW', 'VEH_CREATE', 'ORD_VIEW', 'ORD_CREATE', 'FAC_VIEW'], required: 'FAC_VIEW', allowed: true },
      { role: 'RECEPTIONNISTE', perms: ['VEH_VIEW', 'VEH_CREATE', 'ORD_VIEW', 'ORD_CREATE', 'FAC_VIEW'], required: 'FAC_CREATE', allowed: false },
      { role: 'CAISSIER', perms: ['VEH_VIEW', 'ORD_VIEW', 'FAC_VIEW', 'FAC_PAY', 'STK_VIEW'], required: 'VEH_CREATE', allowed: false },
      // FAC_CREATE inclut FAC_VIEW
      { role: 'CHEF_ATELIER', perms: ['FAC_CREATE'], required: 'FAC_VIEW', allowed: true },
    ];

    cases.forEach(({ role, perms, required, allowed }) => {
      it(`${role} — ${required} : ${allowed ? 'AUTORISÉ' : 'REFUSÉ'}`, () => {
        const { reflector, mockContext } = makeContext(
          makeUser([role], perms),
          [required],
        );
        const guard = new PermissionsGuard(reflector);
        if (allowed) {
          expect(guard.canActivate(mockContext)).toBe(true);
        } else {
          expect(() => guard.canActivate(mockContext)).toThrow(ForbiddenException);
        }
      });
    });
  });
});
