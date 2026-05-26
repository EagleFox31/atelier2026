
import { SetMetadata, createParamDecorator, ExecutionContext } from '@nestjs/common';

// @Public() - Bypass JwtAuthGuard
export const IS_PUBLIC_KEY = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

// @RequireRole() - Contrôle d'accès par rôle
export const ROLES_KEY = 'roles';
export const RequireRole = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);

// @RequirePermission() - Contrôle d'accès par permission
export const PERMISSIONS_KEY = 'permissions';
export const RequirePermission = (...permissions: string[]) => SetMetadata(PERMISSIONS_KEY, permissions);

// @Audit() - Marqueur pour déclencher le log d'audit dans un interceptor ou service
export const AUDIT_KEY = 'audit';
export const Audit = (action: string) => SetMetadata(AUDIT_KEY, action);

// @CurrentUser() - Récupère l'utilisateur depuis la requête
export const CurrentUser = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    return request.user;
  },
);
