import { Controller, Get, Patch, Param } from '@nestjs/common';
import { AdminService } from './admin.service';
import { RequireRole } from '../../decorators/auth.decorator';

@Controller('admin')
@RequireRole('SUPER_ADMIN')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('tenants')
  listTenants() {
    return this.adminService.listTenants();
  }

  @Patch('tenants/:id/toggle-status')
  toggleTenantStatus(@Param('id') id: string) {
    return this.adminService.toggleTenantStatus(id);
  }
}
