import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { SignupController } from './signup.controller';
import { SignupService } from './signup.service';
import { SignupEmailService } from './signup-email.service';

@Module({
  imports: [AuthModule],
  controllers: [SignupController],
  providers: [SignupService, SignupEmailService],
})
export class SignupModule {}
