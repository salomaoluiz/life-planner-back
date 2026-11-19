import {
  accessibleOwners,
  build,
  shoppingList,
  shoppingListRepositoryMock,
  shoppingRow,
} from '@stock/application/mocks/stock.mocks';

import { DeleteShoppingListRowUseCase } from './index';

const mocks = { accessibleOwners, lists: shoppingListRepositoryMock() };
let setup: DeleteShoppingListRowUseCase;

beforeEach(async () => {
  jest.clearAllMocks();
  mocks.lists.findRowById.mockResolvedValue(shoppingRow('r', shoppingList('l')));
  setup = await build(DeleteShoppingListRowUseCase, [
    { provide: 'IShoppingListRepository', useValue: mocks.lists },
  ]);
});

export { mocks, setup };
