import {
  accessibleOwners,
  build,
  catalogRepositoryMock,
  category,
  day,
  item,
  market,
  marketRepositoryMock,
  purchase,
  purchaseRepositoryMock,
  purchaseRow,
  shoppingList,
  shoppingListRepositoryMock,
  stockRepositoryMock,
  userId,
} from '@stock/application/mocks/stock.mocks';

import { ClosePurchaseUseCase } from './index';

const rowA = '0d6f6f0e-6a62-4d77-8d8e-3d6f0b1a1c11';
const rowB = '0d6f6f0e-6a62-4d77-8d8e-3d6f0b1a1c12';
const mocks = {
  accessibleOwners,
  catalog: catalogRepositoryMock(),
  lists: shoppingListRepositoryMock(),
  markets: marketRepositoryMock(),
  postFinance: jest.fn(),
  purchases: purchaseRepositoryMock(),
  stock: stockRepositoryMock(),
};
const base = {
  accessibleOwners,
  accountId: 'account-id',
  date: '2026-11-18',
  id: 'purchase-id',
  receiptTotalCents: 1000,
  rows: [],
  userId,
};
let setup: ClosePurchaseUseCase;

beforeEach(async () => {
  jest.clearAllMocks();
  mocks.purchases.findById.mockResolvedValue(purchase('purchase-id'));
  mocks.lists.findById.mockResolvedValue(
    shoppingList('list-id', { defaultFinanceCategoryId: 'fin-default' }),
  );
  mocks.markets.findById.mockResolvedValue(market('market-id', { name: 'Atacadão' }));
  mocks.catalog.findCategories.mockResolvedValue([
    category('c1', { financeCategoryId: 'fin-food' }),
  ]);
  mocks.purchases.findRows.mockResolvedValue([
    purchaseRow(rowA, {
      item: { categoryId: 'c1', description: 'Rice', id: 'i1', unit: 'unit' as never },
      itemId: 'i1',
      lineTotalCents: 600,
      quantity: 2,
    }),
    purchaseRow(rowB, { description: 'Candle', quantity: 1, unit: 'unit' as never }),
    purchaseRow('gone', { state: 'NOT_FOUND' }),
  ]);
  mocks.purchases.close.mockImplementation(async (params, post) => {
    const reference = await post([]);

    return {
      lots: 2,
      newItemIds: ['n1'],
      purchase: purchase('purchase-id', { ...reference, status: 'CLOSED' as never }),
      removedRows: 1,
      updatedRows: 0,
    };
  });
  mocks.postFinance.mockResolvedValue({ splitId: 'split-1' });
  setup = await build(ClosePurchaseUseCase, [
    { provide: 'IMarketRepository', useValue: mocks.markets },
    { provide: 'IPurchaseRepository', useValue: mocks.purchases },
    { provide: 'IShoppingListRepository', useValue: mocks.lists },
    { provide: 'IStockCatalogRepository', useValue: mocks.catalog },
    { provide: 'IStockRepository', useValue: mocks.stock },
  ]);
});

export { base, day, item, mocks, purchase, purchaseRow, rowA, rowB, setup };
