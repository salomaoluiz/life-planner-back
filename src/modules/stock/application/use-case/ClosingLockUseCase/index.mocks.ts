import {
  accessibleOwners,
  build,
  purchase,
  purchaseRepositoryMock,
  userId,
} from '@stock/application/mocks/stock.mocks';

import { ClosingLockUseCase } from './index';

const mocks = { accessibleOwners, purchases: purchaseRepositoryMock() };
const base = { accessibleOwners, id: 'purchase-id', userId };
let setup: ClosingLockUseCase;

beforeEach(async () => {
  jest.clearAllMocks();
  mocks.purchases.findById.mockResolvedValue(purchase('purchase-id'));
  mocks.purchases.setClosing.mockImplementation(async (id: string, by: null | string, now: Date) =>
    purchase(id, { closingAt: by ? now : undefined, closingBy: by ?? undefined }),
  );
  setup = await build(ClosingLockUseCase, [
    { provide: 'IPurchaseRepository', useValue: mocks.purchases },
  ]);
});

export { base, mocks, setup };
