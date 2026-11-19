import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';
import {
  build,
  catalogRepositoryMock,
  shoppingListRepositoryMock,
  stockRepositoryMock,
} from '@stock/application/mocks/stock.mocks';

import { DeleteStockItemsByOwnerUseCase } from './index';

const mocks = {
  catalog: catalogRepositoryMock(),
  lists: shoppingListRepositoryMock(),
  owner: OwnerType.FAMILY,
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
  ]);
});

export { mocks, setup };
