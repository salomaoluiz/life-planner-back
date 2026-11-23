import {
  accessibleOwners,
  build,
  catalogRepositoryMock,
  category,
  market,
  marketRepositoryMock,
  purchase,
  purchaseRepositoryMock,
  purchaseRow,
  shoppingList,
  shoppingListRepositoryMock,
  userId,
} from '@stock/application/mocks/stock.mocks';
import { PurchaseStatuses } from '@stock/domain/entity/PurchaseEntity';

import { UpdateClosedPurchaseUseCase } from './index';

const mocks = {
  accessibleOwners,
  catalog: catalogRepositoryMock(),
  lists: shoppingListRepositoryMock(),
  markets: marketRepositoryMock(),
  purchases: purchaseRepositoryMock(),
  repost: jest.fn(),
};
const base = { accessibleOwners, id: 'purchase-id', userId };
const closed = purchase('purchase-id', {
  accountId: 'account-id',
  receiptTotalCents: 1000,
  splitId: 'split-1',
  status: PurchaseStatuses.CLOSED,
});
let setup: UpdateClosedPurchaseUseCase;

beforeEach(async () => {
  jest.clearAllMocks();
  mocks.purchases.findById.mockResolvedValue(closed);
  mocks.markets.findById.mockResolvedValue(market('market-id'));
  mocks.lists.findById.mockResolvedValue(
    shoppingList('list-id', { defaultFinanceCategoryId: 'fin' }),
  );
  mocks.catalog.findCategories.mockResolvedValue([category('c1')]);
  mocks.purchases.findRows.mockResolvedValue([
    purchaseRow('r1', { lineTotalCents: 1000, quantity: 1, unitPriceCents: 1000 }),
  ]);
  mocks.purchases.updateClosed.mockImplementation(async (params, repost) => {
    await repost([]);

    return { purchase: closed, rows: [] };
  });
  mocks.repost.mockResolvedValue({ splitId: 'split-2' });
  setup = await build(UpdateClosedPurchaseUseCase, [
    { provide: 'IMarketRepository', useValue: mocks.markets },
    { provide: 'IPurchaseRepository', useValue: mocks.purchases },
    { provide: 'IShoppingListRepository', useValue: mocks.lists },
    { provide: 'IStockCatalogRepository', useValue: mocks.catalog },
  ]);
});

export { base, mocks, purchase, setup };
