import { Controller, Get, Post, Body, Query } from '@nestjs/common';
import { RequirePermission, CurrentUser } from '../../decorators/auth.decorator';
import { CounterSalesService } from './counter-sales.service';
import { CreateCounterSaleDto } from './dto/counter-sales.dto';

@Controller('counter-sales')
export class CounterSalesController {
  constructor(private readonly counterSalesService: CounterSalesService) {}

  @Get()
  @RequirePermission('FAC_VIEW')
  findAll(
    @CurrentUser() user: { garageId?: string | null },
    @Query('search') search?: string,
  ) {
    return this.counterSalesService.findAll(search, user?.garageId);
  }

  @Post()
  @RequirePermission('FAC_PAY')
  create(
    @Body() body: CreateCounterSaleDto,
    @CurrentUser() user: { id: string; garageId?: string | null },
  ) {
    return this.counterSalesService.create(body, user.id, user?.garageId);
  }
}
