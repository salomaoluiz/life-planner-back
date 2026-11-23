import { Module } from '@nestjs/common';

import { AddShoppingListRowUseCase } from '@stock/application/use-case/AddShoppingListRowUseCase';
import { BackfillStockEmbeddingsUseCase } from '@stock/application/use-case/BackfillStockEmbeddingsUseCase';
import { ChangePurchaseStatusUseCase } from '@stock/application/use-case/ChangePurchaseStatusUseCase';
import { ClosePurchaseUseCase } from '@stock/application/use-case/ClosePurchaseUseCase';
import { ClosingLockUseCase } from '@stock/application/use-case/ClosingLockUseCase';
import { CreateMarketUseCase } from '@stock/application/use-case/CreateMarketUseCase';
import { CreateShoppingListUseCase } from '@stock/application/use-case/CreateShoppingListUseCase';
import { CreateStockCategorySuggestionsUseCase } from '@stock/application/use-case/CreateStockCategorySuggestionsUseCase';
import { CreateStockCategoryUseCase } from '@stock/application/use-case/CreateStockCategoryUseCase';
import { CreateStockItemUseCase } from '@stock/application/use-case/CreateStockItemUseCase';
import { CreateStockLocationSuggestionsUseCase } from '@stock/application/use-case/CreateStockLocationSuggestionsUseCase';
import { CreateStockLocationUseCase } from '@stock/application/use-case/CreateStockLocationUseCase';
import { CreateStockMovementUseCase } from '@stock/application/use-case/CreateStockMovementUseCase';
import { DeleteClosedPurchaseUseCase } from '@stock/application/use-case/DeleteClosedPurchaseUseCase';
import { DeletePurchaseRowUseCase } from '@stock/application/use-case/DeletePurchaseRowUseCase';
import { DeleteShoppingListRowUseCase } from '@stock/application/use-case/DeleteShoppingListRowUseCase';
import { DeleteStockCategoryUseCase } from '@stock/application/use-case/DeleteStockCategoryUseCase';
import { DeleteStockItemsByOwnerUseCase } from '@stock/application/use-case/DeleteStockItemsByOwnerUseCase';
import { DeleteStockItemUseCase } from '@stock/application/use-case/DeleteStockItemUseCase';
import { DeleteStockLocationUseCase } from '@stock/application/use-case/DeleteStockLocationUseCase';
import { EnsureDefaultShoppingListUseCase } from '@stock/application/use-case/EnsureDefaultShoppingListUseCase';
import { GetClosePreviewUseCase } from '@stock/application/use-case/GetClosePreviewUseCase';
import { GetFrequentStockItemsUseCase } from '@stock/application/use-case/GetFrequentStockItemsUseCase';
import { GetItemPricesUseCase } from '@stock/application/use-case/GetItemPricesUseCase';
import { GetListPurchasesUseCase } from '@stock/application/use-case/GetListPurchasesUseCase';
import { GetMarketsUseCase } from '@stock/application/use-case/GetMarketsUseCase';
import { GetOwnerChangePreviewUseCase } from '@stock/application/use-case/GetOwnerChangePreviewUseCase';
import { GetPendingPurchasesUseCase } from '@stock/application/use-case/GetPendingPurchasesUseCase';
import { GetPurchaseEventsUseCase } from '@stock/application/use-case/GetPurchaseEventsUseCase';
import { GetPurchaseUseCase } from '@stock/application/use-case/GetPurchaseUseCase';
import { GetRestockSummaryUseCase } from '@stock/application/use-case/GetRestockSummaryUseCase';
import { GetShoppingListByIdUseCase } from '@stock/application/use-case/GetShoppingListByIdUseCase';
import { GetShoppingListsUseCase } from '@stock/application/use-case/GetShoppingListsUseCase';
import { GetStockCategoriesUseCase } from '@stock/application/use-case/GetStockCategoriesUseCase';
import { GetStockItemByIdUseCase } from '@stock/application/use-case/GetStockItemByIdUseCase';
import { GetStockItemsUseCase } from '@stock/application/use-case/GetStockItemsUseCase';
import { GetStockLocationByIdUseCase } from '@stock/application/use-case/GetStockLocationByIdUseCase';
import { GetStockLocationsUseCase } from '@stock/application/use-case/GetStockLocationsUseCase';
import { GetStockMovementsUseCase } from '@stock/application/use-case/GetStockMovementsUseCase';
import { HasStockItemsByOwnerUseCase } from '@stock/application/use-case/HasStockItemsByOwnerUseCase';
import { MergePurchaseUseCase } from '@stock/application/use-case/MergePurchaseUseCase';
import { RefreshStockEmbeddingUseCase } from '@stock/application/use-case/RefreshStockEmbeddingUseCase';
import { SetGestureExpirationUseCase } from '@stock/application/use-case/SetGestureExpirationUseCase';
import { StartPurchaseUseCase } from '@stock/application/use-case/StartPurchaseUseCase';
import { SuggestStockItemsUseCase } from '@stock/application/use-case/SuggestStockItemsUseCase';
import { UndoStockGestureUseCase } from '@stock/application/use-case/UndoStockGestureUseCase';
import { UpdateClosedPurchaseUseCase } from '@stock/application/use-case/UpdateClosedPurchaseUseCase';
import { UpdateMarketUseCase } from '@stock/application/use-case/UpdateMarketUseCase';
import { UpdateShoppingListRowUseCase } from '@stock/application/use-case/UpdateShoppingListRowUseCase';
import { UpdateShoppingListUseCase } from '@stock/application/use-case/UpdateShoppingListUseCase';
import { UpdateStockCategoryUseCase } from '@stock/application/use-case/UpdateStockCategoryUseCase';
import { UpdateStockItemUseCase } from '@stock/application/use-case/UpdateStockItemUseCase';
import { UpdateStockLocationUseCase } from '@stock/application/use-case/UpdateStockLocationUseCase';
import { UpsertPurchaseRowUseCase } from '@stock/application/use-case/UpsertPurchaseRowUseCase';
import { ShoppingListDatasource } from '@stock/data/datasource/ShoppingListDatasource';
import { StockCatalogDatasource } from '@stock/data/datasource/StockCatalogDatasource';
import { StockDatasource } from '@stock/data/datasource/StockDatasource';
import { StockSuggestionDatasource } from '@stock/data/datasource/StockSuggestionDatasource';
import { MarketRepository } from '@stock/data/repository/MarketRepository';
import { PurchaseRepository } from '@stock/data/repository/PurchaseRepository';
import { ShoppingListRepository } from '@stock/data/repository/ShoppingListRepository';
import { StockCatalogRepository } from '@stock/data/repository/StockCatalogRepository';
import { StockRepository } from '@stock/data/repository/StockRepository';
import { StockSuggestionRepository } from '@stock/data/repository/StockSuggestionRepository';

const useCases = [
  ChangePurchaseStatusUseCase,
  ClosePurchaseUseCase,
  ClosingLockUseCase,
  CreateMarketUseCase,
  DeleteClosedPurchaseUseCase,
  DeletePurchaseRowUseCase,
  GetClosePreviewUseCase,
  GetItemPricesUseCase,
  GetListPurchasesUseCase,
  GetMarketsUseCase,
  GetPendingPurchasesUseCase,
  GetPurchaseUseCase,
  GetPurchaseEventsUseCase,
  MergePurchaseUseCase,
  StartPurchaseUseCase,
  UpdateClosedPurchaseUseCase,
  UpdateMarketUseCase,
  UpsertPurchaseRowUseCase,
  AddShoppingListRowUseCase,
  CreateShoppingListUseCase,
  DeleteShoppingListRowUseCase,
  EnsureDefaultShoppingListUseCase,
  GetRestockSummaryUseCase,
  GetShoppingListByIdUseCase,
  GetShoppingListsUseCase,
  UpdateShoppingListRowUseCase,
  UpdateShoppingListUseCase,
  BackfillStockEmbeddingsUseCase,
  CreateStockCategorySuggestionsUseCase,
  CreateStockCategoryUseCase,
  CreateStockItemUseCase,
  CreateStockLocationSuggestionsUseCase,
  CreateStockLocationUseCase,
  CreateStockMovementUseCase,
  DeleteStockCategoryUseCase,
  DeleteStockItemsByOwnerUseCase,
  DeleteStockItemUseCase,
  DeleteStockLocationUseCase,
  GetFrequentStockItemsUseCase,
  GetOwnerChangePreviewUseCase,
  GetStockCategoriesUseCase,
  GetStockItemByIdUseCase,
  GetStockItemsUseCase,
  GetStockLocationByIdUseCase,
  GetStockLocationsUseCase,
  GetStockMovementsUseCase,
  HasStockItemsByOwnerUseCase,
  RefreshStockEmbeddingUseCase,
  SetGestureExpirationUseCase,
  SuggestStockItemsUseCase,
  UndoStockGestureUseCase,
  UpdateStockCategoryUseCase,
  UpdateStockItemUseCase,
  UpdateStockLocationUseCase,
];

@Module({
  exports: [...useCases],
  providers: [
    ...useCases,
    { provide: 'IMarketRepository', useClass: MarketRepository },
    { provide: 'IPurchaseRepository', useClass: PurchaseRepository },
    { provide: 'IShoppingListDatasource', useClass: ShoppingListDatasource },
    { provide: 'IShoppingListRepository', useClass: ShoppingListRepository },
    { provide: 'IStockCatalogDatasource', useClass: StockCatalogDatasource },
    { provide: 'IStockCatalogRepository', useClass: StockCatalogRepository },
    { provide: 'IStockDatasource', useClass: StockDatasource },
    { provide: 'IStockRepository', useClass: StockRepository },
    { provide: 'IStockSuggestionDatasource', useClass: StockSuggestionDatasource },
    { provide: 'IStockSuggestionRepository', useClass: StockSuggestionRepository },
  ],
})
export class StockModule {}
