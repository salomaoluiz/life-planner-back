import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';
import {
  accessibleOwners,
  archivedOwners,
  build,
  shoppingList,
  shoppingListRepositoryMock,
  shoppingRow,
} from '@stock/application/mocks/stock.mocks';
import { StockUnits } from '@stock/domain/entity/StockEntity';

import { UpdateShoppingListRowUseCase } from './index';

const mocks = { accessibleOwners, archivedOwners, lists: shoppingListRepositoryMock() };
const list = shoppingList('l', { isDefault: true });
const milk = {
  description: 'Milk',
  id: 'milk',
  owner: OwnerType.USER,
  ownerId: 'user-id',
  quantity: 2,
  unit: StockUnits.UNIT,
};
let setup: UpdateShoppingListRowUseCase;

beforeEach(async () => {
  jest.clearAllMocks();
  mocks.lists.findRowById.mockResolvedValue(shoppingRow('r', list, { item: milk }));
  mocks.lists.updateRow.mockResolvedValue(shoppingRow('r', list, { item: milk, quantity: 3 }));
  setup = await build(UpdateShoppingListRowUseCase, [
    { provide: 'IShoppingListRepository', useValue: mocks.lists },
  ]);
});

export { list, mocks, setup, shoppingList, shoppingRow };
