import { Controller, Get } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { Public } from './decorators/auth.decorator';

@Controller()
export class AppController {
  @Public()
  @SkipThrottle() // sonde du déploiement (aws-ssm-deploy.sh) et des healthchecks Docker
  @Get('health')
  health() {
    // version / commit : posés au build de l'image (deploy.yml) ; le déploiement
    // vérifie que le commit servi est bien celui qu'il vient de livrer.
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      version: process.env.APP_VERSION || 'dev',
      commit: process.env.APP_COMMIT || 'unknown',
    };
  }
}
