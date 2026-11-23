import {
  accessibleOwners,
  build,
  purchase,
  purchaseRepositoryMock,
  userId,
} from '@stock/application/mocks/stock.mocks';
import { PurchaseStatuses } from '@stock/domain/entity/PurchaseEntity';

import { ChangePurchaseStatusUseCase } from './index';

const mocks = { accessibleOwners, purchases: purchaseRepositoryMock() };
const base = { accessibleOwners, id: 'purchase-id', userId };
let setup: ChangePurchaseStatusUseCase;

beforeEach(async () => {
  jest.clearAllMocks();
  mocks.purchases.findById.mockResolvedValue(purchase('purchase-id'));
  mocks.purchases.transition.mockImplementation(async (id: string, to: PurchaseStatuses) =>
    purchase(id, { status: to }),
  );
  setup = await build(ChangePurchaseStatusUseCase, [
    { provide: 'IPurchaseRepository', useValue: mocks.purchases },
  ]);
});

export { base, mocks, setup };
