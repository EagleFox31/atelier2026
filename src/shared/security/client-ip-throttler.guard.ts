import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

/**
 * ThrottlerGuard à appliquer explicitement (@UseGuards) sur les routes publiques sensibles.
 *
 * ThrottlerModule est configuré dans AppModule, mais aucun ThrottlerGuard n'est enregistré
 * globalement : un @Throttle seul n'a AUCUN effet. Ce garde l'active route par route.
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
