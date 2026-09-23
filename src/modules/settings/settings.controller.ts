import { Body, Controller, Get, Patch, Post, BadRequestException, ForbiddenException } from '@nestjs/common';
import { SettingsService } from './settings.service';
import { UpdateWorkshopSettingsDto } from './dto/workshop-settings.dto';
import { CurrentUser, RequireRole } from '../../decorators/auth.decorator';
import { SubscriptionService } from '../subscription/subscription.service';

@Controller('settings')
export class SettingsController {
  constructor(
    private readonly settingsService: SettingsService,
    private readonly subscriptions: SubscriptionService,
  ) {}

  @Get('workshop')
  getWorkshopSettings(@CurrentUser() user: any) {
    return this.settingsService.getWorkshopSettings(user?.garageId);
  }

  @Patch('workshop')
  @RequireRole('ADMIN', 'SUPER_ADMIN')
  updateWorkshopSettings(
    @Body() body: UpdateWorkshopSettingsDto,
    @CurrentUser() user: any,
  ) {
    return this.settingsService.updateWorkshopSettings(body, user.id, user?.garageId);
  }

  /** Mise à jour du logo (base64 data URL). Envoyer null pour supprimer. */
  @Post('workshop/logo')
  @RequireRole('ADMIN', 'SUPER_ADMIN')
  async updateLogo(
    @Body() body: { logoUrl: string | null },
    @CurrentUser() user: any,
  ) {
    if (user?.tenantId) {
      const subscription = await this.subscriptions.getSummary(user.tenantId);
      if (subscription.status !== 'ACTIVE') {
        throw new ForbiddenException({
          message: 'Le logo personnalisé est disponible après activation d’un forfait payant.',
          errorCode: 'PAID_FEATURE_REQUIRED',
        });
      }
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
    return this.settingsService.updateLogo(logoUrl, user.id, user?.garageId);
  }
}
