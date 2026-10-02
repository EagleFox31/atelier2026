import { Controller, Get } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { Public } from './decorators/auth.decorator';

@Controller()
export class AppController {
  @Public()
  @SkipThrottle() // sonde du déploiement (aws-ssm-deploy.sh) et des healthchecks Docker
  @Get('health')
  health() {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }
}
