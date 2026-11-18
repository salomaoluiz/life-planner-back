import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';
import {
  accessibleOwners,
  archivedOwners,
  build,
  shoppingList,
  shoppingListRepositoryMock,
  userId,
} from '@stock/application/mocks/stock.mocks';

import { CreateShoppingListUseCase } from './index';

const mocks = { accessibleOwners, archivedOwners, lists: shoppingListRepositoryMock() };
const base = {
  accessibleOwners,
  name: 'Pharmacy',
  owner: OwnerType.USER,
  ownerId: userId,
};
let setup: CreateShoppingListUseCase;

beforeEach(async () => {
  jest.clearAllMocks();
  mocks.lists.findByOwners.mockResolvedValue([
    shoppingList('d', { isDefault: true, name: 'Mercado' }),
  ]);
  mocks.lists.create.mockImplementation(async (params) => shoppingList('new', params));
  setup = await build(CreateShoppingListUseCase, [
    { provide: 'IShoppingListRepository', useValue: mocks.lists },
  ]);
});

export { base, mocks, setup };
