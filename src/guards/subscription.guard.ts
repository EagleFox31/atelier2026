import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { SubscriptionStatus } from '@prisma/client';
import { IS_PUBLIC_KEY } from '../decorators/auth.decorator';
import { SubscriptionService } from '../modules/subscription/subscription.service';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

@Injectable()
export class SubscriptionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly subscriptions: SubscriptionService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest();
    const user = request.user as
      | {
          tenantId?: string | null;
          roles?: Array<{ role: { code: string } }>;
        }
      | undefined;

    if (!user?.tenantId) return true;

    const roles = user.roles?.map((entry) => entry.role.code) ?? [];
    if (roles.includes('SUPER_ADMIN')) return true;

    const path = String(request.path ?? request.url ?? '');
    if (
      path.endsWith('/subscription/status') ||
      path.endsWith('/auth/profile') ||
      path.endsWith('/auth/logout')
    ) {
      return true;
    }

    const summary = await this.subscriptions.getSummary(user.tenantId);

    if (
      summary.status === SubscriptionStatus.ACTIVE ||
      summary.status === SubscriptionStatus.TRIAL
    ) {
      return true;
    }

    if (
      summary.status === SubscriptionStatus.GRACE_PERIOD &&
      SAFE_METHODS.has(String(request.method).toUpperCase())
    ) {
      return true;
    }

    if (summary.status === SubscriptionStatus.GRACE_PERIOD) {
      throw new ForbiddenException({
        message:
          'Votre pilote est terminé. Votre espace reste consultable pendant 7 jours, mais les modifications sont désactivées.',
        errorCode: 'TRIAL_READ_ONLY',
        subscriptionStatus: summary.status,
      });
    }

    throw new ForbiddenException({
      message:
        summary.status === SubscriptionStatus.SUSPENDED
          ? 'Votre abonnement est suspendu.'
          : 'Votre pilote est terminé. Choisissez une offre pour reprendre votre activité.',
      errorCode:
        summary.status === SubscriptionStatus.SUSPENDED
          ? 'SUBSCRIPTION_SUSPENDED'
          : 'TRIAL_EXPIRED',
      subscriptionStatus: summary.status,
    });
  }
}
