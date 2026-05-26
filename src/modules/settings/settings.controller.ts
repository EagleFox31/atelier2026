import { Body, Controller, Get, Patch } from '@nestjs/common';
import { SettingsService } from './settings.service';
import { UpdateWorkshopSettingsDto } from './dto/workshop-settings.dto';
import { CurrentUser, RequireRole } from '../../decorators/auth.decorator';

@Controller('settings')
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  /** Lecture — tout utilisateur authentifié (devis, factures, paramètres). */
  @Get('workshop')
  getWorkshopSettings() {
    return this.settingsService.getWorkshopSettings();
  }

  /** Écriture — administrateurs uniquement. */
  @Patch('workshop')
  @RequireRole('ADMIN', 'SUPER_ADMIN')
  updateWorkshopSettings(
    @Body() body: UpdateWorkshopSettingsDto,
    @CurrentUser() user: { id: string },
  ) {
    return this.settingsService.updateWorkshopSettings(body, user.id);
  }
}
