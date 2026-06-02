import { Controller, Get, Query } from '@nestjs/common';
import { AuditService } from './audit.service';
import { RequireRole, CurrentUser } from '../../decorators/auth.decorator';

@Controller('audit')
export class AuditController {
    constructor(private readonly auditService: AuditService) { }

    @Get()
    @RequireRole('ADMIN')
    getLogs(
        @CurrentUser() user: { garageId?: string | null },
        @Query('limit') limit?: string,
        @Query('offset') offset?: string,
        @Query('entityType') entityType?: string,
        @Query('entityId') entityId?: string,
        @Query('performedBy') performedBy?: string,
        @Query('action') action?: string,
    ) {
        return this.auditService.getLogs({
            limit: limit ? parseInt(limit, 10) : 50,
            offset: offset ? parseInt(offset, 10) : 0,
            entityType,
            entityId,
            performedBy,
            action,
        }, user?.garageId);
    }
}
