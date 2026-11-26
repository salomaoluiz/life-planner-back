import {
  accessibleOwners,
  build,
  catalogRepositoryMock,
  familyId,
  stockRepositoryMock,
} from '@stock/application/mocks/stock.mocks';
import { RefreshStaleForecastsUseCase } from '@stock/application/use-case/RefreshStaleForecastsUseCase';

import { GetStockItemsUseCase } from './index';

const mocks = {
  accessibleOwners,
  catalog: catalogRepositoryMock(),
  familyId,
  refresh: { execute: jest.fn().mockResolvedValue(undefined) },
  stock: stockRepositoryMock(),
};
let setup: GetStockItemsUseCase;

beforeEach(async () => {
  jest.clearAllMocks();
  mocks.stock.findByOwners.mockResolvedValue([]);
  mocks.catalog.findCatalogByOwners.mockResolvedValue({
    categories: [],
    locations: [],
    shoppingLists: [],
  });
  setup = await build(GetStockItemsUseCase, [
    { provide: RefreshStaleForecastsUseCase, useValue: mocks.refresh },
    { provide: 'IStockRepository', useValue: mocks.stock },
    { provide: 'IStockCatalogRepository', useValue: mocks.catalog },
  ]);
});

export { mocks, setup };
