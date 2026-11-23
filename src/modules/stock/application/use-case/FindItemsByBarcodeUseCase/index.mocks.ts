import {
  accessibleOwners,
  build,
  catalogRepositoryMock,
  stockRepositoryMock,
} from '@stock/application/mocks/stock.mocks';

import { FindItemsByBarcodeUseCase } from './index';

const mocks = {
  accessibleOwners,
  catalog: catalogRepositoryMock(),
  stock: stockRepositoryMock(),
};
let setup: FindItemsByBarcodeUseCase;

beforeEach(async () => {
  jest.clearAllMocks();
  mocks.stock.findByOwners.mockResolvedValue([]);
  mocks.catalog.findCatalogByOwners.mockResolvedValue({
    categories: [],
    locations: [],
    shoppingLists: [],
  });
  setup = await build(FindItemsByBarcodeUseCase, [
    { provide: 'IStockRepository', useValue: mocks.stock },
    { provide: 'IStockCatalogRepository', useValue: mocks.catalog },
  ]);
});

export { mocks, setup };
