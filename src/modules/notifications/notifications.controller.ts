import { Controller, Get, Post, Patch, Body, Query, Param, HttpCode } from '@nestjs/common';
import { RequireRole, CurrentUser } from '../../decorators/auth.decorator';
import { NotificationsService } from './notifications.service';
import { SendSmsDto } from './dto/notifications.dto';

@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  // ─── SMS ────────────────────────────────────────────────────────────────────

  @Get('sms')
  @RequireRole('ADMIN')
  getSmsHistory(
    @CurrentUser() user: { garageId?: string | null },
    @Query('phone') phone?: string,
  ) {
    return this.notificationsService.getSmsHistory(phone, user?.garageId);
  }

  @Post('sms/send')
  @RequireRole('ADMIN')
  @HttpCode(201)
  sendSms(
    @Body() body: SendSmsDto,
    @CurrentUser() user: { garageId?: string | null },
  ) {
    return this.notificationsService.sendSms(body, user?.garageId);
  }

  // ─── In-App ──────────────────────────────────────────────────────────────────

  /** GET /notifications/inbox — notifications non-lues du user connecté */
  @Get('inbox')
  getInbox(@CurrentUser() user: { id: string }) {
    return this.notificationsService.getInbox(user.id);
  }

  /** GET /notifications/unread-count — badge chiffre */
  @Get('unread-count')
  async getUnreadCount(@CurrentUser() user: { id: string }) {
    const count = await this.notificationsService.getUnreadCount(user.id);
    return { count };
  }

  /** PATCH /notifications/:id/read — marquer une notif comme lue */
  @Patch(':id/read')
  @HttpCode(200)
  markRead(@Param('id') id: string, @CurrentUser() user: { id: string }) {
    return this.notificationsService.markRead(id, user.id);
  }

  /** PATCH /notifications/read-all — tout marquer lu */
  @Patch('read-all')
  @HttpCode(200)
  markAllRead(@CurrentUser() user: { id: string }) {
    return this.notificationsService.markAllRead(user.id);
  }
}
