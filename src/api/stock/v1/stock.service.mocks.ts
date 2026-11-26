import { Test } from '@nestjs/testing';

import { StockService } from '@api/stock/v1/stock.service';
import { GetFamilyMembersUseCase } from '@family/application/use-case/GetFamilyMembersUseCase';
import { GetUserFamilyAccessUseCase } from '@family/application/use-case/GetUserFamilyAccessUseCase';
import { GetCategoriesUseCase } from '@finance/application/use-case/GetCategoriesUseCase';
import { GetCategoryIconsUseCase } from '@finance/application/use-case/GetCategoryIconsUseCase';
import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';
import { category, day, item, location, lot } from '@stock/application/mocks/stock.mocks';
import { toStockItemView } from '@stock/application/service/StockView';
import { CreateStockCategorySuggestionsUseCase } from '@stock/application/use-case/CreateStockCategorySuggestionsUseCase';
import { CreateStockCategoryUseCase } from '@stock/application/use-case/CreateStockCategoryUseCase';
import { CreateStockItemUseCase } from '@stock/application/use-case/CreateStockItemUseCase';
import { CreateStockLocationSuggestionsUseCase } from '@stock/application/use-case/CreateStockLocationSuggestionsUseCase';
import { CreateStockLocationUseCase } from '@stock/application/use-case/CreateStockLocationUseCase';
import { CreateStockMovementUseCase } from '@stock/application/use-case/CreateStockMovementUseCase';
import { DeleteStockCategoryUseCase } from '@stock/application/use-case/DeleteStockCategoryUseCase';
import { DeleteStockItemUseCase } from '@stock/application/use-case/DeleteStockItemUseCase';
import { DeleteStockLocationUseCase } from '@stock/application/use-case/DeleteStockLocationUseCase';
import { DismissLeftoverUseCase } from '@stock/application/use-case/DismissLeftoverUseCase';
import { GetConsumptionWeeksUseCase } from '@stock/application/use-case/GetConsumptionWeeksUseCase';
import { GetFrequentStockItemsUseCase } from '@stock/application/use-case/GetFrequentStockItemsUseCase';
import { GetOwnerChangePreviewUseCase } from '@stock/application/use-case/GetOwnerChangePreviewUseCase';
import { GetStockCategoriesUseCase } from '@stock/application/use-case/GetStockCategoriesUseCase';
import { GetStockItemByIdUseCase } from '@stock/application/use-case/GetStockItemByIdUseCase';
import { GetStockItemsUseCase } from '@stock/application/use-case/GetStockItemsUseCase';
import { GetStockLocationByIdUseCase } from '@stock/application/use-case/GetStockLocationByIdUseCase';
import { GetStockLocationsUseCase } from '@stock/application/use-case/GetStockLocationsUseCase';
import { GetStockMovementsUseCase } from '@stock/application/use-case/GetStockMovementsUseCase';
import { GetWasteUseCase } from '@stock/application/use-case/GetWasteUseCase';
import { SetGestureExpirationUseCase } from '@stock/application/use-case/SetGestureExpirationUseCase';
import { SuggestStockItemsUseCase } from '@stock/application/use-case/SuggestStockItemsUseCase';
import { UndoStockGestureUseCase } from '@stock/application/use-case/UndoStockGestureUseCase';
import { UpdateStockCategoryUseCase } from '@stock/application/use-case/UpdateStockCategoryUseCase';
import { UpdateStockItemUseCase } from '@stock/application/use-case/UpdateStockItemUseCase';
import { UpdateStockLocationUseCase } from '@stock/application/use-case/UpdateStockLocationUseCase';
import StockMovementEntity, { StockMovementTypes } from '@stock/domain/entity/StockMovementEntity';
import { FindUsersByIdsUseCase } from '@user/application/use-case/FindUsersByIdsUseCase';

const userId = 'user-id';
const familyId = 'family-id';
const accessibleOwners = [
  { owner: OwnerType.USER, ownerId: userId },
  { archived: false, owner: OwnerType.FAMILY, ownerId: familyId },
];
const uses = {
  createStockCategory: CreateStockCategoryUseCase,
  createStockCategorySuggestions: CreateStockCategorySuggestionsUseCase,
  createStockItem: CreateStockItemUseCase,
  createStockLocation: CreateStockLocationUseCase,
  createStockLocationSuggestions: CreateStockLocationSuggestionsUseCase,
  createStockMovement: CreateStockMovementUseCase,
  deleteStockCategory: DeleteStockCategoryUseCase,
  deleteStockItem: DeleteStockItemUseCase,
  deleteStockLocation: DeleteStockLocationUseCase,
  dismissLeftover: DismissLeftoverUseCase,
  findUsersByIds: FindUsersByIdsUseCase,
  getCategories: GetCategoriesUseCase,
  getCategoryIcons: GetCategoryIconsUseCase,
  getConsumptionWeeks: GetConsumptionWeeksUseCase,
  getFamilyMembers: GetFamilyMembersUseCase,
  getFrequentStockItems: GetFrequentStockItemsUseCase,
  getOwnerChangePreview: GetOwnerChangePreviewUseCase,
  getStockCategories: GetStockCategoriesUseCase,
  getStockItemById: GetStockItemByIdUseCase,
  getStockItems: GetStockItemsUseCase,
  getStockLocationById: GetStockLocationByIdUseCase,
  getStockLocations: GetStockLocationsUseCase,
  getStockMovements: GetStockMovementsUseCase,
  getUserFamilyAccess: GetUserFamilyAccessUseCase,
  getWaste: GetWasteUseCase,
  setGestureExpiration: SetGestureExpirationUseCase,
  suggestStockItems: SuggestStockItemsUseCase,
  undoStockGesture: UndoStockGestureUseCase,
  updateStockCategory: UpdateStockCategoryUseCase,
  updateStockItem: UpdateStockItemUseCase,
  updateStockLocation: UpdateStockLocationUseCase,
};
const useCases = Object.fromEntries(
  Object.keys(uses).map((name) => [name, { execute: jest.fn() }]),
) as Record<keyof typeof uses, { execute: jest.Mock }>;

const catalog = {
  categories: [
    category('dairy', { financeCategoryId: 'fin' }),
    category('cheese', { parentId: 'dairy' }),
  ],
  locations: [location('fridge')],
  shoppingLists: [],
};
const view = toStockItemView(
  item(
    [
      lot('open', 1, {
        expirationDate: day('2026-12-01'),
        openedAt: day('2026-11-05'),
        purchaseDate: day('2026-11-01'),
      }),
      lot('closed', 2),
    ],
    (f) =>
      f
        .withCategoryId('cheese')
        .withLocationId('fridge')
        .withMinQuantity(1, 4)
        .withBrand('Brand')
        .withOpenedShelfLifeDays(5),
  ),
  day('2026-11-10'),
  catalog,
);
function movement(userIdOfAuthor?: string) {
  return new StockMovementEntity({
    createdAt: new Date('2026-11-10T12:00:00.000Z'),
    id: 'mov',
    itemId: 'item',
    lotId: 'lot',
    quantity: 1,
    type: StockMovementTypes.ENTRY,
    userId: userIdOfAuthor,
  });
}

let setup: StockService;

beforeEach(async () => {
  jest.clearAllMocks();
  useCases.getUserFamilyAccess.execute.mockResolvedValue([{ archived: false, familyId }]);
  useCases.findUsersByIds.execute.mockResolvedValue([{ id: 'author', name: 'Ana' }]);
  useCases.getFamilyMembers.execute.mockResolvedValue([
    { userId: 'author' },
    { userId: undefined },
  ]);

  const module = await Test.createTestingModule({
    providers: [
      StockService,
      ...Object.entries(uses).map(([name, provide]) => ({
        provide,
        useValue: useCases[name as keyof typeof uses],
      })),
    ],
  }).compile();

  setup = module.get(StockService);
});

const mocks = { accessibleOwners, catalog, familyId, movement, userId, view };

export { mocks, setup, useCases };
