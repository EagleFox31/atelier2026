import { Controller, Get, Post, Body, Patch, Param, Delete, Query } from '@nestjs/common';
import { CustomersService } from './customers.service';
import { CustomerType } from '@prisma/client';
import { RequirePermission } from '../../decorators/auth.decorator';
import { CreateCustomerDto, UpdateCustomerDto } from './dto/customer.dto';

@Controller('customers')
export class CustomersController {
    constructor(private readonly customersService: CustomersService) { }

    @Post()
    @RequirePermission('VEH_CREATE')
    create(@Body() body: CreateCustomerDto) {
        return this.customersService.create(body);
    }

    @Get()
    @RequirePermission('VEH_VIEW')
    findAll(@Query('search') search?: string, @Query('type') type?: CustomerType) {
        return this.customersService.findAll(search, type);
    }

    @Get(':id')
    @RequirePermission('VEH_VIEW')
    findOne(@Param('id') id: string) {
        return this.customersService.findOne(id);
    }

    @Patch(':id')
    @RequirePermission('VEH_CREATE')
    update(@Param('id') id: string, @Body() body: UpdateCustomerDto) {
        return this.customersService.update(id, body);
    }

    @Delete(':id')
    @RequirePermission('VEH_CREATE')
    remove(@Param('id') id: string) {
        return this.customersService.remove(id);
    }
}

