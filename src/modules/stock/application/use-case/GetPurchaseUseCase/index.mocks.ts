import {
  accessibleOwners,
  build,
  purchase,
  purchaseRepositoryMock,
  shoppingListRepositoryMock,
} from '@stock/application/mocks/stock.mocks';

import { GetPurchaseUseCase } from './index';

const mocks = {
  accessibleOwners,
  lists: shoppingListRepositoryMock(),
  purchases: purchaseRepositoryMock(),
};
let setup: GetPurchaseUseCase;

beforeEach(async () => {
  jest.clearAllMocks();
  mocks.purchases.findById.mockResolvedValue(purchase('p'));
  mocks.purchases.findByList.mockResolvedValue([purchase('p')]);
  setup = await build(GetPurchaseUseCase, [
    { provide: 'IShoppingListRepository', useValue: mocks.lists },
    { provide: 'IPurchaseRepository', useValue: mocks.purchases },
  ]);
});

export { mocks, setup };
