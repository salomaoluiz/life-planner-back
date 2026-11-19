import {
  accessibleOwners,
  build,
  catalogRepositoryMock,
  category,
  shoppingList,
  shoppingListRepositoryMock,
  shoppingRow,
} from '@stock/application/mocks/stock.mocks';

import { GetShoppingListByIdUseCase } from './index';

const mocks = {
  accessibleOwners,
  catalog: catalogRepositoryMock(),
  lists: shoppingListRepositoryMock(),
};
let setup: GetShoppingListByIdUseCase;

beforeEach(async () => {
  jest.clearAllMocks();
  setup = await build(GetShoppingListByIdUseCase, [
    { provide: 'IShoppingListRepository', useValue: mocks.lists },
    { provide: 'IStockCatalogRepository', useValue: mocks.catalog },
  ]);
});

export { category, mocks, setup, shoppingList, shoppingRow };
