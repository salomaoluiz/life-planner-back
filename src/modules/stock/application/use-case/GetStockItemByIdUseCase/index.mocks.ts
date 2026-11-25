import {
  accessibleOwners,
  build,
  catalogRepositoryMock,
  item,
  lot,
  stockRepositoryMock,
} from '@stock/application/mocks/stock.mocks';
import { RefreshStaleForecastsUseCase } from '@stock/application/use-case/RefreshStaleForecastsUseCase';

import { GetStockItemByIdUseCase } from './index';

const mocks = {
  accessibleOwners,
  catalog: catalogRepositoryMock(),
  refresh: { execute: jest.fn().mockResolvedValue(undefined) },
  stock: stockRepositoryMock(),
};
let setup: GetStockItemByIdUseCase;

beforeEach(async () => {
  jest.clearAllMocks();
  mocks.stock.findById.mockResolvedValue(item([lot('a', 2)]));
  setup = await build(GetStockItemByIdUseCase, [
    { provide: RefreshStaleForecastsUseCase, useValue: mocks.refresh },
    { provide: 'IStockRepository', useValue: mocks.stock },
    { provide: 'IStockCatalogRepository', useValue: mocks.catalog },
  ]);
});

export { mocks, setup };
