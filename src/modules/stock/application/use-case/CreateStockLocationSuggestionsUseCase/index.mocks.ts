import {
  accessibleOwners,
  build,
  catalogRepositoryMock,
} from '@stock/application/mocks/stock.mocks';

import { CreateStockLocationSuggestionsUseCase } from './index';

const mocks = { accessibleOwners, catalog: catalogRepositoryMock() };
let setup: CreateStockLocationSuggestionsUseCase;

beforeEach(async () => {
  jest.clearAllMocks();
  setup = await build(CreateStockLocationSuggestionsUseCase, [
    { provide: 'IStockCatalogRepository', useValue: mocks.catalog },
  ]);
});

export { mocks, setup };
