import { Test } from '@nestjs/testing';

import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';
import StockEntityFixture from '@stock/domain/entity/mocks/StockEntity.fixture';
import ShoppingListEntity from '@stock/domain/entity/ShoppingListEntity';
import ShoppingListRowEntity, {
  ShoppingListRowOrigins,
} from '@stock/domain/entity/ShoppingListRowEntity';
import StockCategoryEntity, { StockCatalogStatus } from '@stock/domain/entity/StockCategoryEntity';
import { StockUnits } from '@stock/domain/entity/StockEntity';
import StockLocationEntity from '@stock/domain/entity/StockLocationEntity';
import StockLotEntity from '@stock/domain/entity/StockLotEntity';
import { ShoppingRowRecord } from '@stock/domain/repository';

export const userId = 'user-id';
export const familyId = 'family-id';
export const accessibleOwners = [
  { owner: OwnerType.USER, ownerId: userId },
  { owner: OwnerType.FAMILY, ownerId: familyId },
];
export const archivedOwners = [
  { owner: OwnerType.USER, ownerId: userId },
  { archived: true, owner: OwnerType.FAMILY, ownerId: familyId },
];
export function day(value: string) {
  return new Date(`${value}T00:00:00.000Z`);
}
export const today = day('2026-11-10');
const date = day('2026-01-01');

type Provider = { provide: (new (...args: never[]) => unknown) | string; useValue: unknown };

export async function build<T>(
  useCase: new (...args: never[]) => T,
  providers: Provider[],
): Promise<T> {
  const module = await Test.createTestingModule({
    providers: [useCase as never, ...providers],
  }).compile();

  return module.get<T>(useCase as never);
}
export function catalogRepositoryMock() {
  return {
    countItemsByCategory: jest.fn().mockResolvedValue(new Map()),
    countItemsByLocation: jest.fn().mockResolvedValue(new Map()),
    createCategories: jest.fn().mockResolvedValue([]),
    createCategory: jest.fn(),
    createLocation: jest.fn(),
    createLocations: jest.fn().mockResolvedValue([]),
    deleteByOwner: jest.fn().mockResolvedValue(undefined),
    deleteCategory: jest.fn().mockResolvedValue(undefined),
    deleteLocation: jest.fn().mockResolvedValue(undefined),
    findCatalogByOwners: jest
      .fn()
      .mockResolvedValue({ categories: [], locations: [], shoppingLists: [] }),
    findCategories: jest.fn().mockResolvedValue([]),
    findCategoryById: jest.fn(),
    findLocationById: jest.fn(),
    findLocations: jest.fn().mockResolvedValue([]),
    setCategoryStatus: jest.fn().mockResolvedValue(undefined),
    updateCategory: jest.fn(),
    updateLocation: jest.fn(),
  };
}
export function category(id: string, extra: Partial<StockCategoryEntity> = {}) {
  return new StockCategoryEntity({
    createdAt: date,
    id,
    name: `Category ${id}`,
    owner: OwnerType.USER,
    ownerId: userId,
    status: StockCatalogStatus.ACTIVE,
    updatedAt: date,
    ...extra,
  });
}
export function embeddingsMock() {
  return { embed: jest.fn().mockResolvedValue(null) };
}
export function item(
  lots: StockLotEntity[] = [],
  build_?: (f: StockEntityFixture) => StockEntityFixture,
) {
  const fixture = new StockEntityFixture().withId('item').withOwnerId(userId).withLots(lots);

  return (build_ ? build_(fixture) : fixture).build();
}
export function location(id: string, extra: Partial<StockLocationEntity> = {}) {
  return new StockLocationEntity({
    createdAt: date,
    id,
    name: `Location ${id}`,
    owner: OwnerType.USER,
    ownerId: userId,
    status: StockCatalogStatus.ACTIVE,
    updatedAt: date,
    ...extra,
  });
}
export function lot(id: string, quantity: number, extra: Partial<StockLotEntity> = {}) {
  return new StockLotEntity({ createdAt: date, id, itemId: 'item', quantity, ...extra });
}
export function shoppingList(id: string, extra: Partial<ShoppingListEntity> = {}) {
  return new ShoppingListEntity({
    createdAt: date,
    currency: 'BRL',
    id,
    isDefault: false,
    name: `List ${id}`,
    owner: OwnerType.USER,
    ownerId: userId,
    status: StockCatalogStatus.ACTIVE,
    updatedAt: date,
    ...extra,
  });
}
export function shoppingListRepositoryMock() {
  return {
    addRow: jest.fn(),
    create: jest.fn(),
    deleteByOwner: jest.fn().mockResolvedValue(undefined),
    deleteRow: jest.fn().mockResolvedValue(undefined),
    ensureDefault: jest.fn(),
    findById: jest.fn(),
    findByOwners: jest.fn().mockResolvedValue([]),
    findRestockRows: jest.fn().mockResolvedValue([]),
    findRowById: jest.fn(),
    findRowsByLists: jest.fn().mockResolvedValue([]),
    update: jest.fn(),
    updateRow: jest.fn(),
  };
}
export function stockRepositoryMock() {
  return {
    applyGestureChange: jest.fn(),
    applyMovement: jest.fn(),
    create: jest.fn(),
    delete: jest.fn().mockResolvedValue(undefined),
    deleteByOwner: jest.fn().mockResolvedValue(0),
    existsByOwner: jest.fn().mockResolvedValue(false),
    findById: jest.fn(),
    findByIds: jest.fn().mockResolvedValue([]),
    findByOwners: jest.fn().mockResolvedValue([]),
    findFrequentItemIds: jest.fn().mockResolvedValue([]),
    findMovements: jest.fn().mockResolvedValue([]),
    update: jest.fn(),
  };
}
export function suggestionRepositoryMock() {
  return {
    findEmbeddingText: jest.fn(),
    findSuggestions: jest.fn().mockResolvedValue([]),
    findWithoutEmbedding: jest.fn().mockResolvedValue([]),
    setEmbedding: jest.fn().mockResolvedValue(undefined),
  };
}
// An item row (`item` given) or a text row, on `list`.
export function shoppingRow(
  id: string,
  list: ShoppingListEntity,
  extra: {
    description?: string;
    item?: ShoppingRowRecord['item'];
    origin?: ShoppingListRowOrigins;
    price?: number;
    quantity?: number;
  } = {},
): ShoppingRowRecord {
  return {
    item: extra.item,
    list,
    row: new ShoppingListRowEntity({
      createdAt: date,
      description: extra.item ? undefined : (extra.description ?? 'Candle'),
      estimatedUnitPriceCents: extra.item ? undefined : extra.price,
      id,
      itemId: extra.item?.id,
      listId: list.id,
      origin: extra.origin ?? ShoppingListRowOrigins.MANUAL,
      quantity: extra.quantity ?? 1,
      unit: extra.item ? undefined : StockUnits.UNIT,
      updatedAt: date,
    }),
  };
}
