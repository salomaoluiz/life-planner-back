import { Module } from '@nestjs/common';

import {
  ItemPriceController,
  ListPurchaseController,
  MarketController,
  PendingPurchaseController,
  PurchaseController,
  PurchaseEventsController,
} from '@api/stock/v1/purchase.controller';
import { PurchaseService } from '@api/stock/v1/purchase.service';
import {
  ShoppingListController,
  ShoppingListSummaryController,
} from '@api/stock/v1/shoppingList.controller';
import { ShoppingListService } from '@api/stock/v1/shoppingList.service';
import {
  StockController,
  StockFrequentController,
  StockGestureController,
  StockLotController,
  StockSuggestionController,
  StockWasteController,
} from '@api/stock/v1/stock.controller';
import { StockService } from '@api/stock/v1/stock.service';
import {
  StockBarcodeController,
  StockItemSuggestionController,
} from '@api/stock/v1/stockBarcode.controller';
import { StockBarcodeService } from '@api/stock/v1/stockBarcode.service';
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
    ShoppingListSummaryController,
    PendingPurchaseController,
    PurchaseEventsController,
    ListPurchaseController,
    ItemPriceController,
    StockSuggestionController,
    StockBarcodeController,
    StockItemSuggestionController,
    StockFrequentController,
    StockController,
    StockGestureController,
    StockLotController,
    StockWasteController,
    StockCategoryController,
    StockLocationController,
    ShoppingListController,
    MarketController,
    PurchaseController,
  ],
  imports: [FamilyModule, FinanceModule, StockModule, UserModule],
  providers: [PurchaseService, ShoppingListService, StockBarcodeService, StockService],
})
export class StockAPIModule {}
