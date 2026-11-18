import {
  accessibleOwners,
  build,
  catalogRepositoryMock,
  stockRepositoryMock,
} from '@stock/application/mocks/stock.mocks';

import { GetFrequentStockItemsUseCase } from './index';

const mocks = { accessibleOwners, catalog: catalogRepositoryMock(), stock: stockRepositoryMock() };
let setup: GetFrequentStockItemsUseCase;

beforeEach(async () => {
  jest.clearAllMocks();
  setup = await build(GetFrequentStockItemsUseCase, [
    { provide: 'IStockRepository', useValue: mocks.stock },
    { provide: 'IStockCatalogRepository', useValue: mocks.catalog },
  ]);
});

export { mocks, setup };
