import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';
import {
  build,
  shoppingList,
  shoppingListRepositoryMock,
  userId,
} from '@stock/application/mocks/stock.mocks';

import { EnsureDefaultShoppingListUseCase } from './index';

const mocks = {
  access: { owner: OwnerType.USER, ownerId: userId },
  lists: shoppingListRepositoryMock(),
};
let setup: EnsureDefaultShoppingListUseCase;

beforeEach(async () => {
  jest.clearAllMocks();
  setup = await build(EnsureDefaultShoppingListUseCase, [
    { provide: 'IShoppingListRepository', useValue: mocks.lists },
  ]);
});

export { mocks, setup, shoppingList };
