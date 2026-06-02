
import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { IS_PUBLIC_KEY, PERMISSIONS_KEY, ROLES_KEY } from '../decorators/auth.decorator';
import { permissionGranted } from '../shared/rbac/permissions';
import { PrismaService } from '../shared/prisma/prisma.service';
import { JwtSecretsService } from '../modules/auth/jwt-secrets.service';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private jwtService: JwtService,
    private reflector: Reflector,
    private prisma: PrismaService,
    private jwtSecrets: JwtSecretsService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest();
    const token = this.extractTokenFromHeader(request);
    if (!token) throw new UnauthorizedException('Token manquant');

    try {
      const payload = await this.jwtSecrets.verifyAsync(this.jwtService, token);

      // Vérification de la tokenVersion pour la révocation (Point 6)
      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
        include: {
          garage: { select: { id: true, name: true, slug: true } },
          tenant: { select: { id: true, name: true, slug: true } },
          roles: {
            include: {
              role: {
                include: {
                  permissions: { include: { permission: true } },
                },
              },
            },
          },
        },
      });

      if (!user || user.status !== 'ACTIVE' || user.tokenVersion !== payload.version) {
        throw new UnauthorizedException('Session invalide ou expirée');
      }

      // On attache l'utilisateur complet à la requête
      request.user = user;
    } catch (err) {
      if (err instanceof UnauthorizedException) throw err;
      throw new UnauthorizedException('Token invalide ou expiré');
    }
    return true;
  }

  private extractTokenFromHeader(request: any): string | undefined {
    const [type, token] = request.headers.authorization?.split(' ') ?? [];
    return type === 'Bearer' ? token : undefined;
  }
}

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredPermissions && !requiredRoles) return true;

    const { user } = context.switchToHttp().getRequest();
    
    // Bypass SUPER_ADMIN et ADMIN
    const userRoles = user.roles.map((ur: any) => ur.role.code);
    if (userRoles.includes('SUPER_ADMIN') || userRoles.includes('ADMIN')) return true;

    // Vérification des rôles
    if (requiredRoles) {
      const hasRole = requiredRoles.some((role) => userRoles.includes(role));
      if (hasRole) return true;
    }

    // Vérification des permissions
    if (requiredPermissions) {
      const userPermissions = user.roles.flatMap((ur: any) => 
        ur.role.permissions.map((rp: any) => rp.permission.code)
      );
      
      const hasPermission = requiredPermissions.every((permission) =>
        permissionGranted(userPermissions, permission),
      );
      
      if (hasPermission) return true;
    }

    throw new ForbiddenException('Permissions insuffisantes');
  }
}
