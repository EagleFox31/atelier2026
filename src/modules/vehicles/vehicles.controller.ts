import { Controller, Get, Post, Body, Patch, Param, Delete, Query } from '@nestjs/common';
import { VehiclesService } from './vehicles.service';
import { RequirePermission } from '../../decorators/auth.decorator';
import { CreateVehicleDto, UpdateVehicleDto } from './dto/vehicle.dto';

@Controller('vehicles')
export class VehiclesController {
    constructor(private readonly vehiclesService: VehiclesService) { }

    @Post()
    @RequirePermission('VEH_CREATE')
    create(@Body() body: CreateVehicleDto) {
        return this.vehiclesService.create(body);
    }

    @Get()
    @RequirePermission('VEH_VIEW')
    findAll(@Query('search') search?: string, @Query('customerId') customerId?: string) {
        return this.vehiclesService.findAll(search, customerId);
    }

    @Get('makes')
    @RequirePermission('VEH_VIEW')
    getMakes() {
        return this.vehiclesService.getMakes();
    }

    @Get('models')
    @RequirePermission('VEH_VIEW')
    getModels(@Query('makeId') makeId?: string) {
        return this.vehiclesService.getModels(makeId);
    }

    @Get(':id')
    @RequirePermission('VEH_VIEW')
    findOne(@Param('id') id: string) {
        return this.vehiclesService.findOne(id);
    }

    @Patch(':id')
    @RequirePermission('VEH_CREATE')
    update(@Param('id') id: string, @Body() body: UpdateVehicleDto) {
        return this.vehiclesService.update(id, body);
    }

    @Delete(':id')
    @RequirePermission('VEH_CREATE')
    remove(@Param('id') id: string) {
        return this.vehiclesService.remove(id);
    }
}
