import {
  accessibleOwners,
  build,
  catalogRepositoryMock,
} from '@stock/application/mocks/stock.mocks';

import { CreateStockLocationUseCase } from './index';

const mocks = { accessibleOwners, catalog: catalogRepositoryMock() };
let setup: CreateStockLocationUseCase;

beforeEach(async () => {
  jest.clearAllMocks();
  setup = await build(CreateStockLocationUseCase, [
    { provide: 'IStockCatalogRepository', useValue: mocks.catalog },
  ]);
});

export { mocks, setup };
