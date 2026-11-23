import {
  accessibleOwners,
  build,
  purchase,
  purchaseRepositoryMock,
  userId,
} from '@stock/application/mocks/stock.mocks';

import { DeleteClosedPurchaseUseCase } from './index';

const mocks = { accessibleOwners, cancel: jest.fn(), purchases: purchaseRepositoryMock() };
const base = { accessibleOwners, id: 'purchase-id', userId };
let setup: DeleteClosedPurchaseUseCase;

beforeEach(async () => {
  jest.clearAllMocks();
  mocks.purchases.findById.mockResolvedValue(purchase('purchase-id'));
  mocks.purchases.deleteClosed.mockResolvedValue({ kept: [] });
  setup = await build(DeleteClosedPurchaseUseCase, [
    { provide: 'IPurchaseRepository', useValue: mocks.purchases },
  ]);
});

export { base, mocks, setup };
