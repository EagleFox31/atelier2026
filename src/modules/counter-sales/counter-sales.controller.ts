import { Controller, Get, Post, Body, Query } from '@nestjs/common';
import { RequirePermission, CurrentUser } from '../../decorators/auth.decorator';
import { CounterSalesService } from './counter-sales.service';
import { CreateCounterSaleDto } from './dto/counter-sales.dto';

@Controller('counter-sales')
export class CounterSalesController {
  constructor(private readonly counterSalesService: CounterSalesService) {}

  @Get()
  @RequirePermission('FAC_CREATE')
  findAll(@Query('search') search?: string) {
    return this.counterSalesService.findAll(search);
  }

  @Post()
  @RequirePermission('FAC_CREATE')
  create(@Body() body: CreateCounterSaleDto, @CurrentUser() user: { id: string }) {
    return this.counterSalesService.create(body, user.id);
  }
}
