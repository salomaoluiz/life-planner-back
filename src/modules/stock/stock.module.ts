import { Module } from '@nestjs/common';

import { CreateStockItemUseCase } from '@stock/application/use-case/CreateStockItemUseCase';
import { DeleteStockItemUseCase } from '@stock/application/use-case/DeleteStockItemUseCase';
import { GetStockItemByIdUseCase } from '@stock/application/use-case/GetStockItemByIdUseCase';
import { GetStockItemsUseCase } from '@stock/application/use-case/GetStockItemsUseCase';
import { HasStockItemsByOwnerUseCase } from '@stock/application/use-case/HasStockItemsByOwnerUseCase';
import { UpdateStockItemUseCase } from '@stock/application/use-case/UpdateStockItemUseCase';
import { StockDatasource } from '@stock/data/datasource/StockDatasource';
import { StockRepository } from '@stock/data/repository/StockRepository';

const useCases = [
  CreateStockItemUseCase,
  DeleteStockItemUseCase,
  GetStockItemByIdUseCase,
  GetStockItemsUseCase,
  HasStockItemsByOwnerUseCase,
  UpdateStockItemUseCase,
];

@Module({
  exports: [...useCases],
  providers: [
    ...useCases,
    { provide: 'IStockRepository', useClass: StockRepository },
    { provide: 'IStockDatasource', useClass: StockDatasource },
  ],
})
export class StockModule {}
