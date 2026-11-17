import {
  accessibleOwners,
  build,
  catalogRepositoryMock,
  familyId,
  stockRepositoryMock,
} from '@stock/application/mocks/stock.mocks';

import { GetStockItemsUseCase } from './index';

const mocks = {
  accessibleOwners,
  catalog: catalogRepositoryMock(),
  familyId,
  stock: stockRepositoryMock(),
};
let setup: GetStockItemsUseCase;

beforeEach(async () => {
  jest.clearAllMocks();
  mocks.stock.findByOwners.mockResolvedValue([]);
  mocks.catalog.findCatalogByOwners.mockResolvedValue({ categories: [], locations: [] });
  setup = await build(GetStockItemsUseCase, [
    { provide: 'IStockRepository', useValue: mocks.stock },
    { provide: 'IStockCatalogRepository', useValue: mocks.catalog },
  ]);
});

export { mocks, setup };
