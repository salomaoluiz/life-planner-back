import {
  accessibleOwners,
  build,
  purchase,
  purchaseRepositoryMock,
  userId,
} from '@stock/application/mocks/stock.mocks';

import { MergePurchaseUseCase } from './index';

const mocks = { accessibleOwners, purchases: purchaseRepositoryMock() };
const base = { accessibleOwners, id: 'a', targetId: 'b', userId };
let setup: MergePurchaseUseCase;

beforeEach(async () => {
  jest.clearAllMocks();
  const byId: Record<string, ReturnType<typeof purchase>> = { a: purchase('a'), b: purchase('b') };

  mocks.purchases.findById.mockImplementation(async (id: string) => byId[id]);
  mocks.purchases.mergeInto.mockResolvedValue(purchase('b'));
  setup = await build(MergePurchaseUseCase, [
    { provide: 'IPurchaseRepository', useValue: mocks.purchases },
  ]);
});

export { base, mocks, setup };
