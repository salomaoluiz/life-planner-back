import {
  accessibleOwners,
  archivedOwners,
  build,
  shoppingList,
  shoppingListRepositoryMock,
} from '@stock/application/mocks/stock.mocks';

import { UpdateShoppingListUseCase } from './index';

const mocks = { accessibleOwners, archivedOwners, lists: shoppingListRepositoryMock() };
const defaultList = shoppingList('d', { isDefault: true, name: 'Mercado' });
const other = shoppingList('o', { name: 'Pharmacy' });
let setup: UpdateShoppingListUseCase;

beforeEach(async () => {
  jest.clearAllMocks();
  const byId = new Map([
    ['d', defaultList],
    ['o', other],
  ]);

  mocks.lists.findById.mockImplementation(async (id: string) => byId.get(id));
  mocks.lists.findByOwners.mockResolvedValue([defaultList, other]);
  mocks.lists.update.mockImplementation(async (params) => shoppingList(params.id));
  setup = await build(UpdateShoppingListUseCase, [
    { provide: 'IShoppingListRepository', useValue: mocks.lists },
  ]);
});

export { defaultList, mocks, other, setup };
