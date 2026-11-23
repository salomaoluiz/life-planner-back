import {
  accessibleOwners,
  build,
  catalogRepositoryMock,
  category,
  day,
  item,
  lot,
  purchase,
  purchaseRepositoryMock,
  purchaseRow,
  shoppingList,
  shoppingListRepositoryMock,
  stockRepositoryMock,
} from '@stock/application/mocks/stock.mocks';
import { SuggestStockItemsUseCase } from '@stock/application/use-case/SuggestStockItemsUseCase';

import { GetClosePreviewUseCase } from './index';

const mocks = {
  accessibleOwners,
  catalog: catalogRepositoryMock(),
  lists: shoppingListRepositoryMock(),
  purchases: purchaseRepositoryMock(),
  stock: stockRepositoryMock(),
  suggest: { execute: jest.fn() },
};
let setup: GetClosePreviewUseCase;

beforeEach(async () => {
  jest.clearAllMocks();
  mocks.purchases.findById.mockResolvedValue(purchase('p', { purchaseDate: day('2026-11-10') }));
  mocks.lists.findById.mockResolvedValue(
    shoppingList('list-id', { defaultFinanceCategoryId: 'fin' }),
  );
  mocks.catalog.findCategories.mockResolvedValue([
    category('c1', { financeCategoryId: 'fin-food' }),
  ]);
  mocks.suggest.execute.mockResolvedValue([]);
  setup = await build(GetClosePreviewUseCase, [
    { provide: 'IShoppingListRepository', useValue: mocks.lists },
    { provide: 'IPurchaseRepository', useValue: mocks.purchases },
    { provide: 'IStockCatalogRepository', useValue: mocks.catalog },
    { provide: 'IStockRepository', useValue: mocks.stock },
    { provide: SuggestStockItemsUseCase, useValue: mocks.suggest },
  ]);
});

export { day, item, lot, mocks, purchaseRow, setup };
