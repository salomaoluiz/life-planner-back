import {
  accessibleOwners,
  build,
  item,
  purchaseRepositoryMock,
  stockRepositoryMock,
} from '@stock/application/mocks/stock.mocks';

import { GetItemPricesUseCase } from './index';

const mocks = {
  accessibleOwners,
  purchases: purchaseRepositoryMock(),
  stock: stockRepositoryMock(),
};
let setup: GetItemPricesUseCase;

beforeEach(async () => {
  jest.clearAllMocks();
  mocks.stock.findById.mockResolvedValue(item());
  setup = await build(GetItemPricesUseCase, [
    { provide: 'IPurchaseRepository', useValue: mocks.purchases },
    { provide: 'IStockRepository', useValue: mocks.stock },
  ]);
});

export { mocks, setup };
