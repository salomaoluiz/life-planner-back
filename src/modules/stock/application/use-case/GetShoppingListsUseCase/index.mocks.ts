import {
  accessibleOwners,
  archivedOwners,
  build,
  shoppingList,
  shoppingListRepositoryMock,
  shoppingRow,
} from '@stock/application/mocks/stock.mocks';
import { RefreshStaleForecastsUseCase } from '@stock/application/use-case/RefreshStaleForecastsUseCase';

import { GetShoppingListsUseCase } from './index';

const mocks = {
  accessibleOwners,
  archivedOwners,
  lists: shoppingListRepositoryMock(),
  refresh: { execute: jest.fn().mockResolvedValue(undefined) },
};
let setup: GetShoppingListsUseCase;

beforeEach(async () => {
  jest.clearAllMocks();
  setup = await build(GetShoppingListsUseCase, [
    { provide: RefreshStaleForecastsUseCase, useValue: mocks.refresh },
    { provide: 'IShoppingListRepository', useValue: mocks.lists },
  ]);
});

export { mocks, setup, shoppingList, shoppingRow };
