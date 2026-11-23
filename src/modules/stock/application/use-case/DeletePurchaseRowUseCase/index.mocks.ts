import {
  accessibleOwners,
  build,
  purchase,
  purchaseRepositoryMock,
  userId,
} from '@stock/application/mocks/stock.mocks';

import { DeletePurchaseRowUseCase } from './index';

const mocks = { accessibleOwners, purchases: purchaseRepositoryMock() };
const base = {
  accessibleOwners,
  purchaseId: 'purchase-id',
  rowId: '0d6f6f0e-6a62-4d77-8d8e-3d6f0b1a1c11',
  userId,
};
let setup: DeletePurchaseRowUseCase;

beforeEach(async () => {
  jest.clearAllMocks();
  mocks.purchases.findById.mockResolvedValue(purchase('purchase-id'));
  setup = await build(DeletePurchaseRowUseCase, [
    { provide: 'IPurchaseRepository', useValue: mocks.purchases },
  ]);
});

export { base, mocks, setup };
