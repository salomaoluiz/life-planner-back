import {
  accessibleOwners,
  build,
  catalogRepositoryMock,
  item,
  lot,
  stockRepositoryMock,
} from '@stock/application/mocks/stock.mocks';

import { GetStockItemByIdUseCase } from './index';

const mocks = { accessibleOwners, catalog: catalogRepositoryMock(), stock: stockRepositoryMock() };
let setup: GetStockItemByIdUseCase;

beforeEach(async () => {
  jest.clearAllMocks();
  mocks.stock.findById.mockResolvedValue(item([lot('a', 2)]));
  setup = await build(GetStockItemByIdUseCase, [
    { provide: 'IStockRepository', useValue: mocks.stock },
    { provide: 'IStockCatalogRepository', useValue: mocks.catalog },
  ]);
});

export { mocks, setup };
