import {
  accessibleOwners,
  build,
  day,
  market,
  marketRepositoryMock,
  purchase,
  purchaseRepositoryMock,
  shoppingList,
  shoppingListRepositoryMock,
  userId,
} from '@stock/application/mocks/stock.mocks';

import { StartPurchaseUseCase } from './index';

const mocks = {
  accessibleOwners,
  lists: shoppingListRepositoryMock(),
  markets: marketRepositoryMock(),
  purchases: purchaseRepositoryMock(),
};
const base = {
  accessibleOwners,
  id: '0d6f6f0e-6a62-4d77-8d8e-3d6f0b1a1c11',
  listId: 'list-id',
  marketId: 'market-id',
  purchaseDate: '2026-11-18',
  userId,
};
let setup: StartPurchaseUseCase;

beforeEach(async () => {
  jest.clearAllMocks();
  mocks.lists.findById.mockResolvedValue(shoppingList('list-id', { currency: 'USD' }));
  mocks.markets.findById.mockResolvedValue(market('market-id'));
  mocks.purchases.create.mockResolvedValue({ created: true, purchase: purchase(base.id) });
  setup = await build(StartPurchaseUseCase, [
    { provide: 'IShoppingListRepository', useValue: mocks.lists },
    { provide: 'IMarketRepository', useValue: mocks.markets },
    { provide: 'IPurchaseRepository', useValue: mocks.purchases },
  ]);
});

export { base, day, mocks, setup };
