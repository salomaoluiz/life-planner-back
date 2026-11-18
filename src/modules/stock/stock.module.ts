import { Module } from '@nestjs/common';

import { BackfillStockEmbeddingsUseCase } from '@stock/application/use-case/BackfillStockEmbeddingsUseCase';
import { CreateStockCategorySuggestionsUseCase } from '@stock/application/use-case/CreateStockCategorySuggestionsUseCase';
import { CreateStockCategoryUseCase } from '@stock/application/use-case/CreateStockCategoryUseCase';
import { CreateStockItemUseCase } from '@stock/application/use-case/CreateStockItemUseCase';
import { CreateStockLocationSuggestionsUseCase } from '@stock/application/use-case/CreateStockLocationSuggestionsUseCase';
import { CreateStockLocationUseCase } from '@stock/application/use-case/CreateStockLocationUseCase';
import { CreateStockMovementUseCase } from '@stock/application/use-case/CreateStockMovementUseCase';
import { DeleteStockCategoryUseCase } from '@stock/application/use-case/DeleteStockCategoryUseCase';
import { DeleteStockItemsByOwnerUseCase } from '@stock/application/use-case/DeleteStockItemsByOwnerUseCase';
import { DeleteStockItemUseCase } from '@stock/application/use-case/DeleteStockItemUseCase';
import { DeleteStockLocationUseCase } from '@stock/application/use-case/DeleteStockLocationUseCase';
import { GetOwnerChangePreviewUseCase } from '@stock/application/use-case/GetOwnerChangePreviewUseCase';
import { GetStockCategoriesUseCase } from '@stock/application/use-case/GetStockCategoriesUseCase';
import { GetStockItemByIdUseCase } from '@stock/application/use-case/GetStockItemByIdUseCase';
import { GetStockItemsUseCase } from '@stock/application/use-case/GetStockItemsUseCase';
import { GetStockLocationsUseCase } from '@stock/application/use-case/GetStockLocationsUseCase';
import { GetStockMovementsUseCase } from '@stock/application/use-case/GetStockMovementsUseCase';
import { HasStockItemsByOwnerUseCase } from '@stock/application/use-case/HasStockItemsByOwnerUseCase';
import { RefreshStockEmbeddingUseCase } from '@stock/application/use-case/RefreshStockEmbeddingUseCase';
import { SuggestStockItemsUseCase } from '@stock/application/use-case/SuggestStockItemsUseCase';
import { UpdateStockCategoryUseCase } from '@stock/application/use-case/UpdateStockCategoryUseCase';
import { UpdateStockItemUseCase } from '@stock/application/use-case/UpdateStockItemUseCase';
import { UpdateStockLocationUseCase } from '@stock/application/use-case/UpdateStockLocationUseCase';
import { StockCatalogDatasource } from '@stock/data/datasource/StockCatalogDatasource';
import { StockDatasource } from '@stock/data/datasource/StockDatasource';
import { StockSuggestionDatasource } from '@stock/data/datasource/StockSuggestionDatasource';
import { StockCatalogRepository } from '@stock/data/repository/StockCatalogRepository';
import { StockRepository } from '@stock/data/repository/StockRepository';
import { StockSuggestionRepository } from '@stock/data/repository/StockSuggestionRepository';

const useCases = [
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
  GetOwnerChangePreviewUseCase,
  GetStockCategoriesUseCase,
  GetStockItemByIdUseCase,
  GetStockItemsUseCase,
  GetStockLocationsUseCase,
  GetStockMovementsUseCase,
  HasStockItemsByOwnerUseCase,
  RefreshStockEmbeddingUseCase,
  SuggestStockItemsUseCase,
  UpdateStockCategoryUseCase,
  UpdateStockItemUseCase,
  UpdateStockLocationUseCase,
];

@Module({
  exports: [...useCases],
  providers: [
    ...useCases,
    { provide: 'IStockCatalogDatasource', useClass: StockCatalogDatasource },
    { provide: 'IStockCatalogRepository', useClass: StockCatalogRepository },
    { provide: 'IStockDatasource', useClass: StockDatasource },
    { provide: 'IStockRepository', useClass: StockRepository },
    { provide: 'IStockSuggestionDatasource', useClass: StockSuggestionDatasource },
    { provide: 'IStockSuggestionRepository', useClass: StockSuggestionRepository },
  ],
})
export class StockModule {}
