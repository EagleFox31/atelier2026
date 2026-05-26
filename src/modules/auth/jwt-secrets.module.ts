import { Global, Module } from '@nestjs/common';
import { JwtSecretsService } from './jwt-secrets.service';

/** Module dédié pour que JwtModule.registerAsync puisse injecter JwtSecretsService. */
@Global()
@Module({
  providers: [JwtSecretsService],
  exports: [JwtSecretsService],
})
export class JwtSecretsModule {}
