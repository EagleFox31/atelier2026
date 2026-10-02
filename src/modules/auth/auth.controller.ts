import { Controller, Post, Get, Patch, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AllowPendingPasswordChange, Public, CurrentUser } from '../../decorators/auth.decorator';
import { ChangePasswordDto } from './dto/change-password.dto';
import { Throttle } from '@nestjs/throttler';
import { RATE_LIMITS } from '../../shared/security/rate-limits';

type AuthUser = {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  employeeCode: string | null;
  status: string;
  tenantId: string | null;
  garageId: string | null;
  onboardingCompletedAt: Date | null;
  mustChangePassword: boolean;
  garage: { id: string; name: string; slug: string } | null;
  tenant: { id: string; name: string; slug: string } | null;
  roles: Array<{
    role: {
      code: string;
      permissions: Array<{ permission: { code: string } }>;
    };
  }>;
};

function mapProfile(user: AuthUser) {
  const userRoles = user.roles.map((ur) => ur.role.code);
  const userPermissions = user.roles.flatMap((ur) =>
    ur.role.permissions.map((rp) => rp.permission.code),
  );

  return {
    id: user.id,
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
    employeeCode: user.employeeCode,
    status: user.status,
    roles: userRoles,
    permissions: userPermissions,
    onboardingCompletedAt: user.onboardingCompletedAt?.toISOString() ?? null,
    mustChangePassword: user.mustChangePassword,
    tenantId: user.tenantId,
    garageId: user.garageId,
    garage: user.garage
      ? { id: user.garage.id, name: user.garage.name, slug: user.garage.slug }
      : null,
    tenant: user.tenant
      ? { id: user.tenant.id, name: user.tenant.name, slug: user.tenant.slug }
      : null,
  };
}

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Throttle(RATE_LIMITS.login)
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() body: { identifier: string; passwordHash: string; password?: string }) {
    // Note: Accept standard 'password' or 'passwordHash' from requests
    const password = body.password || body.passwordHash;
    return this.authService.login(body.identifier, password);
  }

  @Post('logout')
  @AllowPendingPasswordChange()
  @HttpCode(HttpStatus.OK)
  async logout(@CurrentUser() user: AuthUser) {
    return this.authService.logout(user.id);
  }

  @Get('profile')
  @AllowPendingPasswordChange()
  getProfile(@CurrentUser() user: AuthUser) {
    return mapProfile(user);
  }

  @Post('change-password')
  @AllowPendingPasswordChange()
  @HttpCode(HttpStatus.OK)
  async changePassword(@CurrentUser() user: AuthUser, @Body() body: ChangePasswordDto) {
    return this.authService.changePassword(user.id, body.currentPassword, body.newPassword);
  }

  @Public()
  @Throttle(RATE_LIMITS.forgotPassword)
  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  async forgotPassword(@Body() body: { identifier: string }) {
    return this.authService.forgotPassword(body.identifier);
  }

  @Patch('onboarding')
  @HttpCode(HttpStatus.OK)
  async completeOnboarding(@CurrentUser() user: AuthUser) {
    return this.authService.completeOnboarding(user.id);
  }
}
