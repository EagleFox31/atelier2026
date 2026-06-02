import { Body, Controller, Get, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Public } from '../../decorators/auth.decorator';
import { SignupDto } from './dto/signup.dto';
import { SignupService } from './signup.service';

@Controller('public/signup')
export class SignupController {
  constructor(private readonly signup: SignupService) {}

  @Public()
  @Get('status')
  status() {
    return this.signup.getStatus();
  }

  @Public()
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  register(@Body() body: SignupDto) {
    return this.signup.register(body);
  }
}
