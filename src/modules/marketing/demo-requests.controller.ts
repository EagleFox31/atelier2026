import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Body,
  Query,
} from '@nestjs/common';
import { DemoRequestStatus } from '@prisma/client';
import { CurrentUser, RequireRole } from '../../decorators/auth.decorator';
import { UpdateDemoRequestDto } from './dto/update-demo-request.dto';
import { DemoRequestsService } from './demo-requests.service';

@Controller('demo-requests')
@RequireRole('SUPER_ADMIN')
export class DemoRequestsController {
  constructor(private readonly demoRequests: DemoRequestsService) {}

  @Get()
  list(
    @Query('status') status?: DemoRequestStatus,
    @Query('q') q?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.demoRequests.list({
      status,
      q,
      limit: limit ? Number(limit) : undefined,
      offset: offset ? Number(offset) : undefined,
    });
  }

  @Get('stats')
  stats() {
    return this.demoRequests.countByStatus(DemoRequestStatus.NEW).then((newCount) => ({
      new: newCount,
    }));
  }

  @Get(':id')
  getOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.demoRequests.getById(id);
  }

  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateDemoRequestDto,
    @CurrentUser() user: { id: string },
  ) {
    return this.demoRequests.update(id, body, user.id);
  }
}
