import { Body, Controller, Get, Patch } from '@nestjs/common';
import { SettingsService } from './settings.service';
import { UpdateWorkshopSettingsDto } from './dto/workshop-settings.dto';
import { CurrentUser, RequireRole } from '../../decorators/auth.decorator';

@Controller('settings')
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

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
}
