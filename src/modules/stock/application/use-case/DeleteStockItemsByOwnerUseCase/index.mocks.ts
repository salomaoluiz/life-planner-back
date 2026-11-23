import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';
import {
  build,
  catalogRepositoryMock,
  marketRepositoryMock,
  purchaseRepositoryMock,
  shoppingListRepositoryMock,
  stockRepositoryMock,
} from '@stock/application/mocks/stock.mocks';

import { DeleteStockItemsByOwnerUseCase } from './index';

const mocks = {
  catalog: catalogRepositoryMock(),
  lists: shoppingListRepositoryMock(),
  markets: marketRepositoryMock(),
  owner: OwnerType.FAMILY,
  purchases: purchaseRepositoryMock(),
  stock: stockRepositoryMock(),
};
let setup: DeleteStockItemsByOwnerUseCase;

beforeEach(async () => {
  jest.clearAllMocks();
  mocks.stock.deleteByOwner.mockResolvedValue(3);
  setup = await build(DeleteStockItemsByOwnerUseCase, [
    { provide: 'IStockRepository', useValue: mocks.stock },
    { provide: 'IStockCatalogRepository', useValue: mocks.catalog },
    { provide: 'IShoppingListRepository', useValue: mocks.lists },
    { provide: 'IMarketRepository', useValue: mocks.markets },
    { provide: 'IPurchaseRepository', useValue: mocks.purchases },
  ]);
});

export { mocks, setup };
