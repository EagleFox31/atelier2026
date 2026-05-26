import { Injectable } from '@nestjs/common';
import { JwtService, JwtSignOptions } from '@nestjs/jwt';

const DEV_FALLBACK_SECRET = 'atelier-cm-dev-only-secret-do-not-use-in-prod';

export type JwtPayload = {
  sub: string;
  email?: string;
  version: number;
  iat?: number;
  exp?: number;
};

@Injectable()
export class JwtSecretsService {
  constructor() {
    if (process.env.NODE_ENV === 'production') {
      this.getSigningSecret();
    }
  }

  /** Secret actif — signe toujours avec celui-ci */
  getSigningSecret(): string {
    const secret = process.env.JWT_SECRET?.trim();
    if (!secret) {
      if (process.env.NODE_ENV === 'production') {
        throw new Error('JWT_SECRET est obligatoire en production');
      }
      return DEV_FALLBACK_SECRET;
    }
    if (process.env.NODE_ENV === 'production' && secret.length < 32) {
      throw new Error('JWT_SECRET doit faire au moins 32 caractères en production');
    }
    return secret;
  }

  /** Secrets acceptés à la vérification — current puis previous (dédoublonnés) */
  getVerificationSecrets(): string[] {
    const current = process.env.JWT_SECRET?.trim();
    const previous = process.env.JWT_SECRET_PREVIOUS?.trim();
    const secrets: string[] = [];

    if (current) secrets.push(current);
    if (previous && previous !== current) secrets.push(previous);

    if (secrets.length === 0) {
      if (process.env.NODE_ENV === 'production') {
        throw new Error('JWT_SECRET est obligatoire en production');
      }
      return [DEV_FALLBACK_SECRET];
    }

    return secrets;
  }

  getExpiresIn(): NonNullable<JwtSignOptions['expiresIn']> {
    return (process.env.JWT_EXPIRES_IN?.trim() || '1d') as NonNullable<JwtSignOptions['expiresIn']>;
  }

  /** Essaie chaque secret jusqu'à validation réussie (rotation sans coupure) */
  async verifyAsync(jwtService: JwtService, token: string): Promise<JwtPayload> {
    const secrets = this.getVerificationSecrets();
    let lastError: unknown;

    for (const secret of secrets) {
      try {
        return await jwtService.verifyAsync<JwtPayload>(token, { secret });
      } catch (error) {
        lastError = error;
      }
    }

    throw lastError;
  }
}
