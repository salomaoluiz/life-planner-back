import {
  accessibleOwners,
  build,
  catalogRepositoryMock,
} from '@stock/application/mocks/stock.mocks';

import { DeleteStockCategoryUseCase } from './index';

const mocks = { accessibleOwners, catalog: catalogRepositoryMock() };
let setup: DeleteStockCategoryUseCase;

beforeEach(async () => {
  jest.clearAllMocks();
  setup = await build(DeleteStockCategoryUseCase, [
    { provide: 'IStockCatalogRepository', useValue: mocks.catalog },
  ]);
});

export { mocks, setup };
