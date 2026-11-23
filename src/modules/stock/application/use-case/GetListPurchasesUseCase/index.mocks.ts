import {
  accessibleOwners,
  build,
  purchase,
  purchaseRepositoryMock,
  shoppingList,
  shoppingListRepositoryMock,
} from '@stock/application/mocks/stock.mocks';

import { GetListPurchasesUseCase } from './index';

const mocks = {
  accessibleOwners,
  lists: shoppingListRepositoryMock(),
  purchases: purchaseRepositoryMock(),
};
let setup: GetListPurchasesUseCase;

beforeEach(async () => {
  jest.clearAllMocks();
  mocks.lists.findById.mockResolvedValue(shoppingList('list-id'));
  mocks.purchases.findByList.mockResolvedValue([purchase('p')]);
  setup = await build(GetListPurchasesUseCase, [
    { provide: 'IShoppingListRepository', useValue: mocks.lists },
    { provide: 'IPurchaseRepository', useValue: mocks.purchases },
  ]);
});

export { mocks, purchase, setup };
