import {
  accessibleOwners,
  build,
  catalogRepositoryMock,
} from '@stock/application/mocks/stock.mocks';

import { CreateStockCategoryUseCase } from './index';

const mocks = { accessibleOwners, catalog: catalogRepositoryMock() };
let setup: CreateStockCategoryUseCase;

beforeEach(async () => {
  jest.clearAllMocks();
  setup = await build(CreateStockCategoryUseCase, [
    { provide: 'IStockCatalogRepository', useValue: mocks.catalog },
  ]);
});

export { mocks, setup };
