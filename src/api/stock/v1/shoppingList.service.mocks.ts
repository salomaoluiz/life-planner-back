import { Test } from '@nestjs/testing';

import { ShoppingListService } from '@api/stock/v1/shoppingList.service';
import { GetUserFamilyAccessUseCase } from '@family/application/use-case/GetUserFamilyAccessUseCase';
import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';
import { shoppingList, shoppingRow } from '@stock/application/mocks/stock.mocks';
import { AddShoppingListRowUseCase } from '@stock/application/use-case/AddShoppingListRowUseCase';
import { CreateShoppingListUseCase } from '@stock/application/use-case/CreateShoppingListUseCase';
import { DeleteShoppingListRowUseCase } from '@stock/application/use-case/DeleteShoppingListRowUseCase';
import { GetRestockSummaryUseCase } from '@stock/application/use-case/GetRestockSummaryUseCase';
import { GetShoppingListByIdUseCase } from '@stock/application/use-case/GetShoppingListByIdUseCase';
import { GetShoppingListsUseCase } from '@stock/application/use-case/GetShoppingListsUseCase';
import { UpdateShoppingListRowUseCase } from '@stock/application/use-case/UpdateShoppingListRowUseCase';
import { UpdateShoppingListUseCase } from '@stock/application/use-case/UpdateShoppingListUseCase';
import { ShoppingListRowOrigins } from '@stock/domain/entity/ShoppingListRowEntity';
import { StockUnits } from '@stock/domain/entity/StockEntity';

const userId = 'user-id';
const familyId = 'family-id';
const uses = {
  addRow: AddShoppingListRowUseCase,
  create: CreateShoppingListUseCase,
  deleteRow: DeleteShoppingListRowUseCase,
  getById: GetShoppingListByIdUseCase,
  getFamilyAccess: GetUserFamilyAccessUseCase,
  getLists: GetShoppingListsUseCase,
  restock: GetRestockSummaryUseCase,
  update: UpdateShoppingListUseCase,
  updateRow: UpdateShoppingListRowUseCase,
};
const useCases = Object.fromEntries(
  Object.keys(uses).map((name) => [name, { execute: jest.fn() }]),
) as Record<keyof typeof uses, { execute: jest.Mock }>;
const accessibleOwners = [
  { owner: OwnerType.USER, ownerId: userId },
  { archived: false, owner: OwnerType.FAMILY, ownerId: familyId },
];
const list = shoppingList('list', { isDefault: true });
const family = shoppingList('flist', { owner: OwnerType.FAMILY, ownerId: familyId });
const rowView = {
  description: 'Milk',
  estimateCents: 2934,
  id: 'row',
  itemId: 'item',
  origin: ShoppingListRowOrigins.AUTO,
  priceSource: 'MANUAL' as const,
  quantity: 6,
  stock: { categoryPath: 'Dairy', idealQuantity: 8, minQuantity: 3, quantity: 2 },
  unit: StockUnits.UNIT,
  unitPriceCents: 489,
};
let setup: ShoppingListService;

beforeEach(async () => {
  jest.clearAllMocks();
  useCases.getFamilyAccess.execute.mockResolvedValue([{ archived: false, familyId, name: 'Casa' }]);

  const module = await Test.createTestingModule({
    providers: [
      ShoppingListService,
      ...Object.entries(uses).map(([name, provide]) => ({
        provide,
        useValue: useCases[name as keyof typeof uses],
      })),
    ],
  }).compile();

  setup = module.get(ShoppingListService);
});

const mocks = { accessibleOwners, family, list, rowView, shoppingRow, userId };

export { mocks, setup, useCases };
