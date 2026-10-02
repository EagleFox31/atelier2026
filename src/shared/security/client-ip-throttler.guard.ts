import { ExecutionContext, HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { ThrottlerGuard, type ThrottlerLimitDetail } from '@nestjs/throttler';
import { isRateLimitEnabled } from './rate-limits';

/**
 * Garde GLOBALE de limitation de débit (APP_GUARD dans AppModule, LESSON-2026-009).
 * Sans elle, les @Throttle n'avaient aucun effet. Limites : src/shared/security/rate-limits.ts.
 *
 * Derrière Caddy, req.ip est l'IP du proxy (même compteur pour tout le monde) : on suit
 * l'IP client transmise dans X-Forwarded-For. On prend l'entrée la plus à droite, celle
 * ajoutée par notre proxy, qu'un client ne peut pas falsifier en envoyant son propre en-tête.
 */
@Injectable()
export class ClientIpThrottlerGuard extends ThrottlerGuard {
  protected async getTracker(req: Record<string, any>): Promise<string> {
    return clientIpOf(req);
  }

  protected async shouldSkip(context: ExecutionContext): Promise<boolean> {
    if (!isRateLimitEnabled()) return true;
    return super.shouldSkip(context);
  }

  /** 429 au format métier (errorCode RATE_LIMITED), Retry-After posé par ThrottlerGuard. */
  protected async throwThrottlingException(
    _context: ExecutionContext,
    detail: ThrottlerLimitDetail,
  ): Promise<void> {
    throw new HttpException(
      {
        message: 'Trop de tentatives. Patientez un instant avant de réessayer.',
        errorCode: 'RATE_LIMITED',
        retryAfterSeconds: Math.max(1, Math.ceil(detail.timeToExpire / 1000)),
      },
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }
}

export function clientIpOf(req: {
  headers?: Record<string, string | string[] | undefined>;
  ip?: string;
  socket?: { remoteAddress?: string };
}): string {
  const raw = req.headers?.['x-forwarded-for'];
  const header = Array.isArray(raw) ? raw.join(',') : raw;
  const forwarded = header
    ?.split(',')
    .map((part) => part.trim())
    .filter(Boolean)
    .pop();
  return forwarded || req.ip || req.socket?.remoteAddress || 'unknown';
}
