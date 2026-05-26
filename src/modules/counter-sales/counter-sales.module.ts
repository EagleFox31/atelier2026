import { Module } from '@nestjs/common';
import { SharedModule } from '../../shared/shared.module';
import { CounterSalesController } from './counter-sales.controller';
import { CounterSalesService } from './counter-sales.service';

@Module({
  imports: [SharedModule],
  controllers: [CounterSalesController],
  providers: [CounterSalesService],
  exports: [CounterSalesService],
})
export class CounterSalesModule {}
