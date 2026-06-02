import { Controller, Get, Post, Body, Patch, Param, Delete, Query } from '@nestjs/common';
import { CustomersService } from './customers.service';
import { CustomerType } from '@prisma/client';
import { RequirePermission, CurrentUser } from '../../decorators/auth.decorator';
import { CreateCustomerDto, UpdateCustomerDto } from './dto/customer.dto';

@Controller('customers')
export class CustomersController {
    constructor(private readonly customersService: CustomersService) { }

    @Post()
    @RequirePermission('VEH_CREATE')
    create(@CurrentUser() user: any, @Body() body: CreateCustomerDto) {
        return this.customersService.create(body, user.garageId);
    }

    @Get()
    @RequirePermission('VEH_VIEW')
    findAll(@CurrentUser() user: any, @Query('search') search?: string, @Query('type') type?: CustomerType) {
        return this.customersService.findAll(search, type, user.garageId);
    }

    @Get(':id')
    @RequirePermission('VEH_VIEW')
    findOne(@CurrentUser() user: any, @Param('id') id: string) {
        return this.customersService.findOne(id, user.garageId);
    }

    @Patch(':id')
    @RequirePermission('VEH_CREATE')
    update(@CurrentUser() user: any, @Param('id') id: string, @Body() body: UpdateCustomerDto) {
        return this.customersService.update(id, body, user.garageId);
    }

    @Delete(':id')
    @RequirePermission('VEH_CREATE')
    remove(@CurrentUser() user: any, @Param('id') id: string) {
        return this.customersService.remove(id, user.garageId);
    }
}
