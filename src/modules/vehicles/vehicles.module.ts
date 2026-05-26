import { Module } from '@nestjs/common';
import { SharedModule } from '../../shared/shared.module';
import { VehiclesService } from './vehicles.service';
import { VehiclesController } from './vehicles.controller';

@Module({
    imports: [SharedModule],
    providers: [VehiclesService],
    controllers: [VehiclesController],
    exports: [VehiclesService],
})
export class VehiclesModule { }
