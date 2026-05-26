import { Module } from '@nestjs/common';
import { SharedModule } from '../../shared/shared.module';
import { CustomersService } from './customers.service';
import { CustomersController } from './customers.controller';

@Module({
    imports: [SharedModule],
    providers: [CustomersService],
    controllers: [CustomersController],
    exports: [CustomersService],
})
export class CustomersModule { }
