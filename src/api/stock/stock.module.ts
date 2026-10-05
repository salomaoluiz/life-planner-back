import { Module } from '@nestjs/common';

import { StockController } from '@api/stock/v1/stock.controller';
import { StockService } from '@api/stock/v1/stock.service';
import { FamilyModule } from '@family/family.module';
import { StockModule } from '@stock/stock.module';

@Module({
  controllers: [StockController],
  imports: [FamilyModule, StockModule],
  providers: [StockService],
})
export class StockAPIModule {}
