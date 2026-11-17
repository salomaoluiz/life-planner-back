import {
  accessibleOwners,
  build,
  catalogRepositoryMock,
} from '@stock/application/mocks/stock.mocks';

import { UpdateStockLocationUseCase } from './index';

const mocks = { accessibleOwners, catalog: catalogRepositoryMock() };
let setup: UpdateStockLocationUseCase;

beforeEach(async () => {
  jest.clearAllMocks();
  setup = await build(UpdateStockLocationUseCase, [
    { provide: 'IStockCatalogRepository', useValue: mocks.catalog },
  ]);
});

export { mocks, setup };
