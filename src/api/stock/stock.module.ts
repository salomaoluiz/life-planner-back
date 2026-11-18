import { Module } from '@nestjs/common';

import {
  StockController,
  StockFrequentController,
  StockGestureController,
  StockSuggestionController,
} from '@api/stock/v1/stock.controller';
import { StockService } from '@api/stock/v1/stock.service';
import {
  StockCategoryController,
  StockLocationController,
} from '@api/stock/v1/stockCatalog.controller';
import { FamilyModule } from '@family/family.module';
import { FinanceModule } from '@finance/finance.module';
import { StockModule } from '@stock/stock.module';
import { UserModule } from '@user/user.module';

@Module({
  // StockSuggestionController first: `GET stock/items/suggestions` must win over `GET stock/items/:id`.
  controllers: [
    StockSuggestionController,
    StockFrequentController,
    StockController,
    StockGestureController,
    StockCategoryController,
    StockLocationController,
  ],
  imports: [FamilyModule, FinanceModule, StockModule, UserModule],
  providers: [StockService],
})
export class StockAPIModule {}
