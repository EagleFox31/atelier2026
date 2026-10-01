import { Body, Controller, Get, Patch, Post, BadRequestException } from '@nestjs/common';
import { SettingsService, applyBrandingEntitlement } from './settings.service';
import { UpdateWorkshopSettingsDto } from './dto/workshop-settings.dto';
import { CurrentUser, RequireRole } from '../../decorators/auth.decorator';
import { SubscriptionService } from '../subscription/subscription.service';
import { featureRequiredError, hasFeature, type EntitlementContext } from '../subscription/entitlements';

@Controller('settings')
export class SettingsController {
  constructor(
    private readonly settingsService: SettingsService,
    private readonly subscriptions: SubscriptionService,
  ) {}

  /**
   * Contexte d'abonnement du tenant, ou null pour un compte sans tenant
   * (plateforme / données historiques) qui garde un accès complet.
   */
  private async entitlementContext(user: any): Promise<EntitlementContext | null> {
    if (!user?.tenantId) return null;
    const { status, plan } = await this.subscriptions.getSummary(user.tenantId);
    return { status, plan };
  }

  private async brandingEnabled(user: any): Promise<boolean> {
    const ctx = await this.entitlementContext(user);
    return ctx === null || hasFeature(ctx, 'branding');
  }

  @Get('workshop')
  async getWorkshopSettings(@CurrentUser() user: any) {
    const [settings, branding] = await Promise.all([
      this.settingsService.getWorkshopSettings(user?.garageId),
      this.brandingEnabled(user),
    ]);
    return applyBrandingEntitlement(settings, branding);
  }

  @Patch('workshop')
  @RequireRole('ADMIN', 'SUPER_ADMIN')
  async updateWorkshopSettings(
    @Body() body: UpdateWorkshopSettingsDto,
    @CurrentUser() user: any,
  ) {
    const [settings, branding] = await Promise.all([
      this.settingsService.updateWorkshopSettings(body, user.id, user?.garageId),
      this.brandingEnabled(user),
    ]);
    return applyBrandingEntitlement(settings, branding);
  }

  /** Mise à jour du logo (base64 data URL). Envoyer null pour supprimer. */
  @Post('workshop/logo')
  @RequireRole('ADMIN', 'SUPER_ADMIN')
  async updateLogo(
    @Body() body: { logoUrl: string | null },
    @CurrentUser() user: any,
  ) {
    const ctx = await this.entitlementContext(user);
    if (ctx && !hasFeature(ctx, 'branding')) {
      throw featureRequiredError('branding', ctx);
    }

    const { logoUrl } = body;
    if (logoUrl !== null) {
      if (!logoUrl.startsWith('data:image/')) {
        throw new BadRequestException('Format invalide — attendu data:image/...');
      }
      // Limite ~500 KB en base64 (≈ 666 Ko fichier original)
      if (logoUrl.length > 900_000) {
        throw new BadRequestException('Logo trop volumineux — maximum 500 KB');
      }
    }
    const settings = await this.settingsService.updateLogo(logoUrl, user.id, user?.garageId);
    return applyBrandingEntitlement(settings, true);
  }
}
