import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';
import {
  accessibleOwners,
  build,
  catalogRepositoryMock,
  familyId,
  item,
  lot,
  stockRepositoryMock,
} from '@stock/application/mocks/stock.mocks';

import { RefreshStockEmbeddingUseCase } from '../RefreshStockEmbeddingUseCase';
import { UpdateStockItemUseCase } from './index';

const refresh = { execute: jest.fn() };
const mocks = {
  accessibleOwners,
  catalog: catalogRepositoryMock(),
  familyId,
  refresh,
  stock: stockRepositoryMock(),
};
let setup: UpdateStockItemUseCase;

beforeEach(async () => {
  jest.clearAllMocks();
  refresh.execute.mockResolvedValue(true);
  mocks.stock.findById.mockResolvedValue(item([]));
  mocks.stock.update.mockImplementation(async () => item([lot('lot', 1)]));
  setup = await build(UpdateStockItemUseCase, [
    { provide: 'IStockRepository', useValue: mocks.stock },
    { provide: 'IStockCatalogRepository', useValue: mocks.catalog },
    { provide: RefreshStockEmbeddingUseCase, useValue: refresh },
  ]);
});

export { mocks, OwnerType, setup };
