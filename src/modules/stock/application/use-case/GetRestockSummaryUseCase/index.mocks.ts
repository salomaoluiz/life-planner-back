import {
  accessibleOwners,
  archivedOwners,
  build,
  shoppingList,
  shoppingListRepositoryMock,
  shoppingRow,
} from '@stock/application/mocks/stock.mocks';

import { GetRestockSummaryUseCase } from './index';

const mocks = { accessibleOwners, archivedOwners, lists: shoppingListRepositoryMock() };
let setup: GetRestockSummaryUseCase;

beforeEach(async () => {
  jest.clearAllMocks();
  setup = await build(GetRestockSummaryUseCase, [
    { provide: 'IShoppingListRepository', useValue: mocks.lists },
  ]);
});

export { mocks, setup, shoppingList, shoppingRow };
