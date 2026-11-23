import {
  accessibleOwners,
  build,
  purchaseRepositoryMock,
  shoppingList,
  shoppingListRepositoryMock,
} from '@stock/application/mocks/stock.mocks';

import { GetPurchaseEventsUseCase } from './index';

const mocks = {
  accessibleOwners,
  lists: shoppingListRepositoryMock(),
  purchases: purchaseRepositoryMock(),
};
let setup: GetPurchaseEventsUseCase;

beforeEach(async () => {
  jest.clearAllMocks();
  mocks.lists.findById.mockResolvedValue(shoppingList('list-id'));
  setup = await build(GetPurchaseEventsUseCase, [
    { provide: 'IShoppingListRepository', useValue: mocks.lists },
    { provide: 'IPurchaseRepository', useValue: mocks.purchases },
  ]);
});

export { mocks, setup };
