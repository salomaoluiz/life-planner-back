import {
  accessibleOwners,
  build,
  catalogRepositoryMock,
  location,
} from '@stock/application/mocks/stock.mocks';

import { GetStockLocationByIdUseCase } from './index';

const mocks = { accessibleOwners, catalog: catalogRepositoryMock() };
let setup: GetStockLocationByIdUseCase;

beforeEach(async () => {
  jest.clearAllMocks();
  setup = await build(GetStockLocationByIdUseCase, [
    { provide: 'IStockCatalogRepository', useValue: mocks.catalog },
  ]);
});

export { location, mocks, setup };
