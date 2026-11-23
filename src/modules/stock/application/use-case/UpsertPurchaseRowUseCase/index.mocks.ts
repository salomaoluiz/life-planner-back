import {
  accessibleOwners,
  build,
  item,
  purchase,
  purchaseRepositoryMock,
  purchaseRow,
  shoppingList,
  shoppingListRepositoryMock,
  shoppingRow,
  stockRepositoryMock,
  userId,
} from '@stock/application/mocks/stock.mocks';

import { UpsertPurchaseRowUseCase } from './index';

const rowId = '0d6f6f0e-6a62-4d77-8d8e-3d6f0b1a1c11';
const mocks = {
  accessibleOwners,
  lists: shoppingListRepositoryMock(),
  purchases: purchaseRepositoryMock(),
  stock: stockRepositoryMock(),
};
const base = { accessibleOwners, purchaseId: 'purchase-id', rowId, userId };
let setup: UpsertPurchaseRowUseCase;

beforeEach(async () => {
  jest.clearAllMocks();
  mocks.purchases.findById.mockResolvedValue(purchase('purchase-id'));
  mocks.purchases.findRows.mockResolvedValue([]);
  mocks.purchases.upsertRow.mockImplementation(async (params) => ({
    convertedToOutside: false,
    row: purchaseRow(params.rowId, {
      description: params.description,
      lineTotalCents: params.lineTotalCents ?? undefined,
      quantity: params.quantity ?? undefined,
      unitPriceCents: params.unitPriceCents ?? undefined,
    }),
  }));
  setup = await build(UpsertPurchaseRowUseCase, [
    { provide: 'IShoppingListRepository', useValue: mocks.lists },
    { provide: 'IPurchaseRepository', useValue: mocks.purchases },
    { provide: 'IStockRepository', useValue: mocks.stock },
  ]);
});

export { base, item, mocks, purchaseRow, rowId, setup, shoppingList, shoppingRow };
