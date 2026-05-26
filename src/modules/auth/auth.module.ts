import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtSecretsService } from './jwt-secrets.service';
import { JwtSecretsModule } from './jwt-secrets.module';

@Module({
  imports: [
    JwtSecretsModule,
    JwtModule.registerAsync({
      global: true,
      imports: [JwtSecretsModule],
      inject: [JwtSecretsService],
      useFactory: (jwtSecrets: JwtSecretsService) => ({
        secret: jwtSecrets.getSigningSecret(),
        signOptions: { expiresIn: jwtSecrets.getExpiresIn() },
      }),
    }),
  ],
  providers: [AuthService],
  controllers: [AuthController],
  exports: [AuthService, JwtSecretsModule],
})
export class AuthModule {}
