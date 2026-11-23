import {
  accessibleOwners,
  archivedOwners,
  build,
  purchaseRepositoryMock,
  userId,
} from '@stock/application/mocks/stock.mocks';

import { GetPendingPurchasesUseCase } from './index';

const mocks = { accessibleOwners, archivedOwners, purchases: purchaseRepositoryMock() };
let setup: GetPendingPurchasesUseCase;

beforeEach(async () => {
  jest.clearAllMocks();
  setup = await build(GetPendingPurchasesUseCase, [
    { provide: 'IPurchaseRepository', useValue: mocks.purchases },
  ]);
});

export { mocks, setup, userId };
