import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';
import {
  accessibleOwners,
  build,
  catalogRepositoryMock,
  item,
  lot,
  stockRepositoryMock,
} from '@stock/application/mocks/stock.mocks';
import { StockUnits } from '@stock/domain/entity/StockEntity';

import { RefreshStockEmbeddingUseCase } from '../RefreshStockEmbeddingUseCase';
import { CreateStockItemUseCase } from './index';

const refresh = { execute: jest.fn() };
const mocks = {
  accessibleOwners,
  catalog: catalogRepositoryMock(),
  refresh,
  stock: stockRepositoryMock(),
};
const base = {
  accessibleOwners,
  description: 'Milk',
  owner: OwnerType.USER,
  ownerId: 'user-id',
  unit: StockUnits.UNIT,
  userId: 'user-id',
};
let setup: CreateStockItemUseCase;

beforeEach(async () => {
  jest.clearAllMocks();
  refresh.execute.mockResolvedValue(true);
  mocks.catalog.findCategoryById.mockResolvedValue(undefined);
  mocks.catalog.findLocationById.mockResolvedValue(undefined);
  mocks.stock.create.mockResolvedValue(item([lot('lot', 2)]));
  setup = await build(CreateStockItemUseCase, [
    { provide: 'IStockRepository', useValue: mocks.stock },
    { provide: 'IStockCatalogRepository', useValue: mocks.catalog },
    { provide: RefreshStockEmbeddingUseCase, useValue: refresh },
  ]);
});

export { base, mocks, setup };
