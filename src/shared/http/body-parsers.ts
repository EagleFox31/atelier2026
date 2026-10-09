import type { INestApplication } from '@nestjs/common';
import { json, urlencoded } from 'express';

/**
 * Routes dont le corps HTTP brut est conservé (`request.rawBody`) : un webhook signé
 * se vérifie sur les octets reçus, jamais sur un JSON resérialisé.
 */
export const RAW_BODY_PATH_PREFIXES = ['/api/subscription/webhooks/', '/api/webhooks/'] as const;

export type RawBodyRequest = { rawBody?: Buffer };

export function keepsRawBody(url: string): boolean {
  return RAW_BODY_PATH_PREFIXES.some((prefix) => url.startsWith(prefix));
}

/**
 * Parsers du corps des requêtes, partagés par `main.ts` et les tests HTTP.
 * L'application doit être créée avec `bodyParser: false`.
 * Les logos sont envoyés en data URL (<= 500 KB fichier) : limite globale 1 Mo.
 */
export function applyBodyParsers(app: INestApplication): void {
  app.use(json({
    limit: '1mb',
    verify: (request, _response, buffer) => {
      if (keepsRawBody(String(request.url ?? ''))) {
        (request as typeof request & RawBodyRequest).rawBody = Buffer.from(buffer);
      }
    },
  }));
  app.use(urlencoded({ limit: '1mb', extended: true }));
}
