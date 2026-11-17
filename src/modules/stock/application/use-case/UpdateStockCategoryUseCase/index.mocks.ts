import {
  accessibleOwners,
  build,
  catalogRepositoryMock,
} from '@stock/application/mocks/stock.mocks';

import { UpdateStockCategoryUseCase } from './index';

const mocks = { accessibleOwners, catalog: catalogRepositoryMock() };
let setup: UpdateStockCategoryUseCase;

beforeEach(async () => {
  jest.clearAllMocks();
  setup = await build(UpdateStockCategoryUseCase, [
    { provide: 'IStockCatalogRepository', useValue: mocks.catalog },
  ]);
});

export { mocks, setup };
