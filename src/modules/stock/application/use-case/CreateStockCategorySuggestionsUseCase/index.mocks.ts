import {
  accessibleOwners,
  build,
  catalogRepositoryMock,
} from '@stock/application/mocks/stock.mocks';

import { CreateStockCategorySuggestionsUseCase } from './index';

const mocks = { accessibleOwners, catalog: catalogRepositoryMock() };
let setup: CreateStockCategorySuggestionsUseCase;

beforeEach(async () => {
  jest.clearAllMocks();
  setup = await build(CreateStockCategorySuggestionsUseCase, [
    { provide: 'IStockCatalogRepository', useValue: mocks.catalog },
  ]);
});

export { mocks, setup };
