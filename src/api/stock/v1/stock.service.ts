import { Injectable } from '@nestjs/common';

import {
  CreateStockCategoryApiInput,
  CreateStockItemApiInput,
  CreateStockLocationApiInput,
  CreateStockMovementApiInput,
  StockCategoryNodeOutput,
  StockItemApiOutput,
  StockListItemApiOutput,
  UpdateStockCategoryApiInput,
  UpdateStockItemApiInput,
  UpdateStockLocationApiInput,
  WasteApiOutput,
} from '@api/stock/v1/dto/stock.dto';
import { GetFamilyMembersUseCase } from '@family/application/use-case/GetFamilyMembersUseCase';
import { GetUserFamilyAccessUseCase } from '@family/application/use-case/GetUserFamilyAccessUseCase';
import { GetCategoriesUseCase } from '@finance/application/use-case/GetCategoriesUseCase';
import { AccountStatus, TransactionType } from '@finance/domain/enum';
import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';
import { StockItemView } from '@stock/application/service/StockView';
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
import { OwnerAccess } from '@stock/domain/entity/OwnerAccess';
import StockCategoryEntity from '@stock/domain/entity/StockCategoryEntity';
import StockLocationEntity from '@stock/domain/entity/StockLocationEntity';
import StockMovementEntity, {
  StockMovementReasons,
} from '@stock/domain/entity/StockMovementEntity';
import { FindUsersByIdsUseCase } from '@user/application/use-case/FindUsersByIdsUseCase';

export function toListItemOutput(view: StockItemView): StockListItemApiOutput {
  const { item } = view;

  return {
    barcode: item.barcode ?? null,
    brand: item.brand ?? null,
    category: view.category ?? null,
    categoryId: item.categoryId ?? null,
    createdAt: item.createdAt.toISOString(),
    description: item.description,
    ...(view.effectiveShoppingListId === undefined
      ? {}
      : { effectiveShoppingListId: view.effectiveShoppingListId }),
    ...(item.estimatedUnitPriceCents === undefined
      ? {}
      : { estimatedUnitPriceCents: item.estimatedUnitPriceCents }),
    expirationStatus: view.expirationStatus,
    forecast: view.forecast
      ? {
          computedOn: dayOrNull(view.forecast.computedOn),
          dailyRate: view.forecast.dailyRate,
          emptyDate: dayOrNull(view.forecast.emptyDate),
          minDate: dayOrNull(view.forecast.minDate),
          status: view.forecast.status,
          weeklyRate: view.forecast.weeklyRate,
        }
      : null,
    hasExpiredLot: view.hasExpiredLot,
    hasForecastRow: view.hasForecastRow,
    hasOpenLot: view.hasOpenLot,
    id: item.id,
    idealQuantity: item.idealQuantity ?? null,
    leftover: view.leftover
      ? {
          date: day(view.leftover.date),
          lotId: view.leftover.lotId,
          quantity: view.leftover.quantity,
        }
      : null,
    location: view.location ?? null,
    locationId: item.locationId ?? null,
    minQuantity: item.minQuantity ?? null,
    nearestExpiration: dayOrNull(view.nearestExpiration),
    needsRestock: view.needsRestock,
    notes: item.notes ?? null,
    openedShelfLifeDays: item.openedShelfLifeDays ?? null,
    owner: item.owner,
    ownerId: item.ownerId,
    quantity: view.quantity,
    quickStep: item.quickStep ?? null,
    restockQuantity: view.restockQuantity,
    ...(item.shoppingListId === undefined ? {} : { shoppingListId: item.shoppingListId }),
    stockOnly: item.stockOnly,
    unit: item.unit,
    updatedAt: item.updatedAt.toISOString(),
    warnDaysClosed: item.warnDaysClosed,
    warnDaysOpened: item.warnDaysOpened,
  };
}

function day(date: Date) {
  return date.toISOString().slice(0, 10);
}
function dayOrNull(date?: Date) {
  return date ? day(date) : null;
}
function toCategoryOutput(category: StockCategoryEntity) {
  return {
    financeCategoryId: category.financeCategoryId ?? null,
    id: category.id,
    name: category.name,
    owner: category.owner,
    ownerId: category.ownerId,
    parentId: category.parentId ?? null,
    status: category.status,
  };
}
function toItemOutput(view: StockItemView): StockItemApiOutput {
  return {
    ...toListItemOutput(view),
    forecastRow: view.forecastRow
      ? {
          listId: view.forecastRow.listId,
          listName: view.forecastRow.listName ?? null,
          quantity: view.forecastRow.quantity,
        }
      : null,
    lots: view.lots.map(
      ({ effectiveExpiration, expirationStatus, leftoverDismissed, leftoverQuantity, lot }) => ({
        currency: lot.currency ?? null,
        effectiveExpiration: dayOrNull(effectiveExpiration),
        expirationDate: dayOrNull(lot.expirationDate),
        expirationStatus,
        id: lot.id,
        leftoverDismissed,
        leftoverQuantity: leftoverQuantity ?? null,
        openedAt: dayOrNull(lot.openedAt),
        purchaseDate: dayOrNull(lot.purchaseDate),
        quantity: lot.quantity,
        unitPriceCents: lot.unitPriceCents ?? null,
      }),
    ),
    waste90d: view.waste90d
      ? { ...view.waste90d, mainReason: view.waste90d.mainReason as StockMovementReasons }
      : null,
  };
}
function toLocationOutput(location: StockLocationEntity, itemCount?: number) {
  return {
    id: location.id,
    ...(itemCount === undefined ? {} : { itemCount }),
    name: location.name,
    owner: location.owner,
    ownerId: location.ownerId,
    status: location.status,
  };
}

@Injectable()
export class StockService {
  constructor(
    private readonly createStockCategorySuggestionsUseCase: CreateStockCategorySuggestionsUseCase,
    private readonly createStockCategoryUseCase: CreateStockCategoryUseCase,
    private readonly createStockItemUseCase: CreateStockItemUseCase,
    private readonly createStockLocationSuggestionsUseCase: CreateStockLocationSuggestionsUseCase,
    private readonly createStockLocationUseCase: CreateStockLocationUseCase,
    private readonly createStockMovementUseCase: CreateStockMovementUseCase,
    private readonly deleteStockCategoryUseCase: DeleteStockCategoryUseCase,
    private readonly deleteStockItemUseCase: DeleteStockItemUseCase,
    private readonly deleteStockLocationUseCase: DeleteStockLocationUseCase,
    private readonly findUsersByIdsUseCase: FindUsersByIdsUseCase,
    private readonly dismissLeftoverUseCase: DismissLeftoverUseCase,
    private readonly getCategoriesUseCase: GetCategoriesUseCase,
    private readonly getConsumptionWeeksUseCase: GetConsumptionWeeksUseCase,
    private readonly getFamilyMembersUseCase: GetFamilyMembersUseCase,
    private readonly getFrequentStockItemsUseCase: GetFrequentStockItemsUseCase,
    private readonly getOwnerChangePreviewUseCase: GetOwnerChangePreviewUseCase,
    private readonly getStockCategoriesUseCase: GetStockCategoriesUseCase,
    private readonly getStockItemByIdUseCase: GetStockItemByIdUseCase,
    private readonly getStockItemsUseCase: GetStockItemsUseCase,
    private readonly getStockLocationByIdUseCase: GetStockLocationByIdUseCase,
    private readonly getStockLocationsUseCase: GetStockLocationsUseCase,
    private readonly getStockMovementsUseCase: GetStockMovementsUseCase,
    private readonly getUserFamilyAccessUseCase: GetUserFamilyAccessUseCase,
    private readonly getWasteUseCase: GetWasteUseCase,
    private readonly setGestureExpirationUseCase: SetGestureExpirationUseCase,
    private readonly suggestStockItemsUseCase: SuggestStockItemsUseCase,
    private readonly undoStockGestureUseCase: UndoStockGestureUseCase,
    private readonly updateStockCategoryUseCase: UpdateStockCategoryUseCase,
    private readonly updateStockItemUseCase: UpdateStockItemUseCase,
    private readonly updateStockLocationUseCase: UpdateStockLocationUseCase,
  ) {}

  async create(userId: string, input: CreateStockItemApiInput): Promise<StockItemApiOutput> {
    const accessibleOwners = await this.getAccessibleOwners(userId);

    return toItemOutput(
      await this.createStockItemUseCase.execute({ ...input, accessibleOwners, userId }),
    );
  }

  async createCategory(userId: string, input: CreateStockCategoryApiInput) {
    const accessibleOwners = await this.getAccessibleOwners(userId);
    const financeCategories = input.financeCategoryId
      ? await this.getFinanceCategories(accessibleOwners, input.ownerId)
      : undefined;

    return toCategoryOutput(
      await this.createStockCategoryUseCase.execute({
        ...input,
        accessibleOwners,
        financeCategories,
      }),
    );
  }

  async createCategorySuggestions(
    userId: string,
    input: { owner: OwnerType; ownerId: string },
    language: 'en-US' | 'pt-BR',
  ) {
    const accessibleOwners = await this.getAccessibleOwners(userId);
    const categories = await this.createStockCategorySuggestionsUseCase.execute({
      ...input,
      accessibleOwners,
      language,
    });

    return { items: categories.map((category) => toCategoryOutput(category)) };
  }

  async createLocation(userId: string, input: CreateStockLocationApiInput) {
    const accessibleOwners = await this.getAccessibleOwners(userId);

    return toLocationOutput(
      await this.createStockLocationUseCase.execute({ ...input, accessibleOwners }),
    );
  }

  async createLocationSuggestions(
    userId: string,
    input: { owner: OwnerType; ownerId: string },
    language: 'en-US' | 'pt-BR',
  ) {
    const accessibleOwners = await this.getAccessibleOwners(userId);
    const locations = await this.createStockLocationSuggestionsUseCase.execute({
      ...input,
      accessibleOwners,
      language,
    });

    return { items: locations.map((location) => toLocationOutput(location)) };
  }

  async createMovement(
    userId: string,
    itemId: string,
    input: CreateStockMovementApiInput,
    clientId?: string,
  ) {
    const accessibleOwners = await this.getAccessibleOwners(userId);
    const result = await this.createStockMovementUseCase.execute({
      ...input,
      accessibleOwners,
      clientId,
      itemId,
      userId,
    });

    return {
      item: toItemOutput(result.item),
      movements: await this.toMovementOutputs(userId, result.item.item, result.movements),
    };
  }

  async delete(userId: string, id: string): Promise<void> {
    const accessibleOwners = await this.getAccessibleOwners(userId);

    await this.deleteStockItemUseCase.execute({ accessibleOwners, id });
  }

  async deleteCategory(userId: string, id: string): Promise<void> {
    await this.deleteStockCategoryUseCase.execute({
      accessibleOwners: await this.getAccessibleOwners(userId),
      id,
    });
  }

  async deleteLocation(userId: string, id: string): Promise<void> {
    await this.deleteStockLocationUseCase.execute({
      accessibleOwners: await this.getAccessibleOwners(userId),
      id,
    });
  }

  async findAll(
    userId: string,
    query: { categoryId?: string[]; locationId?: string[]; ownerId?: string; today?: string },
  ): Promise<StockListItemApiOutput[]> {
    const accessibleOwners = await this.getAccessibleOwners(userId);
    const views = await this.getStockItemsUseCase.execute({
      accessibleOwners,
      categoryIds: query.categoryId,
      locationIds: query.locationId,
      ownerId: query.ownerId,
      today: query.today,
    });

    return views.map((view) => toListItemOutput(view));
  }

  // Spec 123 FR 25: 204 on both; the dismissal hides the warning of that lot until it moves or the leftover grows.
  async dismissLeftover(userId: string, lotId: string, dismissed: boolean): Promise<void> {
    await this.dismissLeftoverUseCase.execute({
      accessibleOwners: await this.getAccessibleOwners(userId),
      dismissed,
      lotId,
    });
  }

  async findById(userId: string, id: string, today?: string): Promise<StockItemApiOutput> {
    const accessibleOwners = await this.getAccessibleOwners(userId);

    return toItemOutput(
      await this.getStockItemByIdUseCase.execute({ accessibleOwners, id, today }),
    );
  }

  async findCategories(
    userId: string,
    query: { includeArchived: boolean; owner: OwnerType; ownerId: string },
  ) {
    const rows = await this.getStockCategoriesUseCase.execute({
      ...query,
      accessibleOwners: await this.getAccessibleOwners(userId),
    });
    const nodes = new Map<string, StockCategoryNodeOutput>(
      rows.map(({ category, effectiveFinanceCategoryId, itemCount }) => [
        category.id,
        {
          children: [],
          effectiveFinanceCategoryId: effectiveFinanceCategoryId ?? null,
          financeCategoryId: category.financeCategoryId ?? null,
          id: category.id,
          itemCount,
          name: category.name,
          parentId: category.parentId ?? null,
          status: category.status,
        },
      ]),
    );
    const roots: StockCategoryNodeOutput[] = [];

    for (const node of nodes.values()) {
      const parent = node.parentId ? nodes.get(node.parentId) : undefined;

      (parent ? parent.children : roots).push(node);
    }

    return { items: roots };
  }

  // Spec 123 FR 30: `owner` is accepted for symmetry with the other lists; the id decides (no owner = "Todas").
  async findConsumptionWeeks(userId: string, id: string, today?: string) {
    const weeks = await this.getConsumptionWeeksUseCase.execute({
      accessibleOwners: await this.getAccessibleOwners(userId),
      id,
      today,
    });

    return {
      weeks: weeks.map((week) => ({
        excluded: week.excluded,
        quantity: week.quantity,
        start: day(week.start),
      })),
    };
  }

  async findFrequent(userId: string, query: { limit?: number; today?: string }) {
    const views = await this.getFrequentStockItemsUseCase.execute({
      accessibleOwners: await this.getAccessibleOwners(userId),
      limit: query.limit,
      today: query.today,
    });

    return { items: views.map((view) => toListItemOutput(view)) };
  }

  async findLocationById(userId: string, id: string) {
    const { itemCount, location } = await this.getStockLocationByIdUseCase.execute({
      accessibleOwners: await this.getAccessibleOwners(userId),
      id,
    });

    return toLocationOutput(location, itemCount);
  }

  async findLocations(
    userId: string,
    query: { includeArchived: boolean; owner: OwnerType; ownerId: string },
  ) {
    const rows = await this.getStockLocationsUseCase.execute({
      ...query,
      accessibleOwners: await this.getAccessibleOwners(userId),
    });

    return { items: rows.map(({ itemCount, location }) => toLocationOutput(location, itemCount)) };
  }

  async findMovements(userId: string, itemId: string, cursor?: string) {
    const accessibleOwners = await this.getAccessibleOwners(userId);
    const page = await this.getStockMovementsUseCase.execute({ accessibleOwners, cursor, itemId });

    return {
      items: await this.toMovementOutputs(userId, page.owner, page.items),
      nextCursor: page.nextCursor,
    };
  }

  async findWaste(userId: string, query: { month?: string; ownerId?: string; topLimit?: 'all' }) {
    return this.getWasteUseCase.execute({
      accessibleOwners: await this.getAccessibleOwners(userId),
      month: query.month,
      ownerId: query.ownerId,
      topLimit: query.topLimit,
    }) as Promise<WasteApiOutput>;
  }

  async ownerChangePreview(userId: string, id: string, owner: OwnerType, ownerId: string) {
    return this.getOwnerChangePreviewUseCase.execute({
      accessibleOwners: await this.getAccessibleOwners(userId),
      id,
      owner,
      ownerId,
    });
  }

  async setGestureExpiration(
    userId: string,
    gestureId: string,
    input: { expirationDate: string; today?: string },
  ) {
    return {
      item: toItemOutput(
        await this.setGestureExpirationUseCase.execute({
          ...input,
          accessibleOwners: await this.getAccessibleOwners(userId),
          gestureId,
          userId,
        }),
      ),
    };
  }

  async suggest(userId: string, query: { owner?: OwnerType; ownerId?: string; q: string }) {
    const suggestions = await this.suggestStockItemsUseCase.execute({
      ...query,
      accessibleOwners: await this.getAccessibleOwners(userId),
    });

    return {
      items: suggestions.map((suggestion) => ({ ...suggestion, brand: suggestion.brand ?? null })),
    };
  }

  async undoGesture(userId: string, gestureId: string) {
    return {
      item: toItemOutput(
        await this.undoStockGestureUseCase.execute({
          accessibleOwners: await this.getAccessibleOwners(userId),
          gestureId,
          userId,
        }),
      ),
    };
  }

  async update(
    userId: string,
    id: string,
    input: UpdateStockItemApiInput,
  ): Promise<StockItemApiOutput> {
    const accessibleOwners = await this.getAccessibleOwners(userId);

    return toItemOutput(
      await this.updateStockItemUseCase.execute({ ...input, accessibleOwners, id }),
    );
  }

  async updateCategory(userId: string, id: string, input: UpdateStockCategoryApiInput) {
    const accessibleOwners = await this.getAccessibleOwners(userId);
    const financeCategories = input.financeCategoryId
      ? await this.getFinanceCategories(
          accessibleOwners,
          await this.ownerIdOfCategory(accessibleOwners, id),
        )
      : undefined;

    return toCategoryOutput(
      await this.updateStockCategoryUseCase.execute({
        ...input,
        accessibleOwners,
        financeCategories,
        id,
      }),
    );
  }

  async updateLocation(userId: string, id: string, input: UpdateStockLocationApiInput) {
    return toLocationOutput(
      await this.updateStockLocationUseCase.execute({
        ...input,
        accessibleOwners: await this.getAccessibleOwners(userId),
        id,
      }),
    );
  }

  // Resolved on every request: the caller plus every family they own or joined (spec 005, C1).
  private async getAccessibleOwners(userId: string): Promise<OwnerAccess[]> {
    const families = await this.getUserFamilyAccessUseCase.execute(userId);

    return [
      { owner: OwnerType.USER, ownerId: userId },
      ...families.map(({ archived, familyId }) => ({
        archived,
        owner: OwnerType.FAMILY,
        ownerId: familyId,
      })),
    ];
  }

  // The finance categories the owner can use, as the rules need them (type and archived flag).
  private async getFinanceCategories(accessibleOwners: OwnerAccess[], ownerId: string) {
    const categories = await this.getCategoriesUseCase.execute({
      accessibleOwners,
      ownerIds: [ownerId],
    });

    return categories.map((category) => ({
      archived: category.status === AccountStatus.ARCHIVED,
      id: category.id,
      isExpense: category.type === TransactionType.EXPENSE,
    }));
  }

  // The owner of a stock category, to scope the finance categories of an update (404 stays the use case's job).
  private async ownerIdOfCategory(accessibleOwners: OwnerAccess[], id: string): Promise<string> {
    for (const owner of accessibleOwners) {
      const rows = await this.getStockCategoriesUseCase.execute({
        accessibleOwners,
        includeArchived: true,
        owner: owner.owner,
        ownerId: owner.ownerId,
      });

      if (rows.some((row) => row.category.id === id)) {
        return owner.ownerId;
      }
    }

    return accessibleOwners[0].ownerId;
  }

  // FR "Ownership": a movement's author shows only while still a member of the item's owner ("Ex-membro" otherwise).
  private async currentMemberIds(
    userId: string,
    item: { owner: OwnerType; ownerId: string },
  ): Promise<Set<string>> {
    if (item.owner === OwnerType.USER) {
      return new Set([item.ownerId]);
    }

    try {
      const members = await this.getFamilyMembersUseCase.execute({
        familyId: item.ownerId,
        userId,
      });

      return new Set(members.flatMap((member) => (member.userId ? [member.userId] : [])));
    } catch {
      return new Set();
    }
  }

  private async toMovementOutputs(
    userId: string,
    item: { owner: OwnerType; ownerId: string },
    movements: StockMovementEntity[],
  ) {
    const authorIds = [...new Set(movements.flatMap((movement) => movement.userId ?? []))];
    const [users, memberIds] = await Promise.all([
      this.findUsersByIdsUseCase.execute({ ids: authorIds }),
      this.currentMemberIds(userId, item),
    ]);
    const names = new Map(users.map((user) => [user.id, user.name]));

    return movements.map((movement) => {
      const name = movement.userId ? names.get(movement.userId) : undefined;

      return {
        createdAt: movement.createdAt.toISOString(),
        currency: movement.currency ?? null,
        id: movement.id,
        lotId: movement.lotId,
        note: movement.note ?? null,
        quantity: movement.quantity,
        reason: movement.reason ?? null,
        type: movement.type,
        unitPriceCents: movement.unitPriceCents ?? null,
        user:
          movement.userId && name !== undefined && memberIds.has(movement.userId)
            ? { id: movement.userId, name }
            : null,
        valueCents: movement.valueCents ?? null,
        valueSource: movement.valueSource ?? null,
      };
    });
  }
}
