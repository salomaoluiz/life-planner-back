import {
  accessibleOwners,
  build,
  purchase,
  purchaseRepositoryMock,
  purchaseRow,
  stockRepositoryMock,
  userId,
} from '@stock/application/mocks/stock.mocks';

import { AddPurchaseRowByCodeUseCase } from './index';

const rowId = '0d6f6f0e-6a62-4d77-8d8e-3d6f0b1a1c11';
const mocks = {
  off: { getProduct: jest.fn() },
  purchases: purchaseRepositoryMock(),
  stock: stockRepositoryMock(),
};
const base = { accessibleOwners, code: '7891000100103', purchaseId: 'purchase-id', rowId, userId };
let setup: AddPurchaseRowByCodeUseCase;

beforeEach(async () => {
  jest.clearAllMocks();
  mocks.purchases.findById.mockResolvedValue(purchase('purchase-id'));
  mocks.purchases.upsertRow.mockImplementation(async (params) => ({
    convertedToOutside: false,
    row: purchaseRow(params.rowId, { description: params.description, quantity: params.quantity }),
  }));
  mocks.stock.findByOwners.mockResolvedValue([]);
  mocks.off.getProduct.mockResolvedValue(null);
  setup = await build(AddPurchaseRowByCodeUseCase, [
    { provide: 'IPurchaseRepository', useValue: mocks.purchases },
    { provide: 'IStockRepository', useValue: mocks.stock },
    { provide: 'IOpenFoodFacts', useValue: mocks.off },
  ]);
});

export { base, mocks, rowId, setup };
