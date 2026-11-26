import {
  accessibleOwners,
  build,
  catalogRepositoryMock,
  category,
  shoppingList,
  shoppingListRepositoryMock,
  shoppingRow,
} from '@stock/application/mocks/stock.mocks';
import { RefreshStaleForecastsUseCase } from '@stock/application/use-case/RefreshStaleForecastsUseCase';

import { GetShoppingListByIdUseCase } from './index';

const mocks = {
  accessibleOwners,
  catalog: catalogRepositoryMock(),
  lists: shoppingListRepositoryMock(),
  refresh: { execute: jest.fn().mockResolvedValue(undefined) },
};
let setup: GetShoppingListByIdUseCase;

beforeEach(async () => {
  jest.clearAllMocks();
  setup = await build(GetShoppingListByIdUseCase, [
    { provide: RefreshStaleForecastsUseCase, useValue: mocks.refresh },
    { provide: 'IShoppingListRepository', useValue: mocks.lists },
    { provide: 'IStockCatalogRepository', useValue: mocks.catalog },
  ]);
});

export { category, mocks, setup, shoppingList, shoppingRow };
