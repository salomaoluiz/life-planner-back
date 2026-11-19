import {
  accessibleOwners,
  archivedOwners,
  build,
  item,
  shoppingList,
  shoppingListRepositoryMock,
  shoppingRow,
  stockRepositoryMock,
} from '@stock/application/mocks/stock.mocks';

import { AddShoppingListRowUseCase } from './index';

const mocks = {
  accessibleOwners,
  archivedOwners,
  lists: shoppingListRepositoryMock(),
  stock: stockRepositoryMock(),
};
const list = shoppingList('l', { isDefault: true });
let setup: AddShoppingListRowUseCase;

beforeEach(async () => {
  jest.clearAllMocks();
  mocks.lists.findById.mockResolvedValue(list);
  mocks.lists.addRow.mockImplementation(async () => ({
    merged: false,
    row: shoppingRow('r', list),
  }));
  mocks.stock.findById.mockResolvedValue(item([]));
  setup = await build(AddShoppingListRowUseCase, [
    { provide: 'IShoppingListRepository', useValue: mocks.lists },
    { provide: 'IStockRepository', useValue: mocks.stock },
  ]);
});

export { item, list, mocks, setup, shoppingList };
