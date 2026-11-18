import {
  accessibleOwners,
  archivedOwners,
  build,
  shoppingList,
  shoppingListRepositoryMock,
  shoppingRow,
} from '@stock/application/mocks/stock.mocks';

import { GetShoppingListsUseCase } from './index';

const mocks = { accessibleOwners, archivedOwners, lists: shoppingListRepositoryMock() };
let setup: GetShoppingListsUseCase;

beforeEach(async () => {
  jest.clearAllMocks();
  setup = await build(GetShoppingListsUseCase, [
    { provide: 'IShoppingListRepository', useValue: mocks.lists },
  ]);
});

export { mocks, setup, shoppingList, shoppingRow };
