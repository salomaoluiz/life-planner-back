import {
  ForbiddenException,
  Inject,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';

import { UseCaseWithParams } from '@shared/application/use-case/types';
import { validate } from '@shared/infra/validation';
import {
  UpdateStockItemInput,
  UpdateStockItemSchema,
} from '@stock/application/dto/UpdateStockItem';
import { planOwnerChange } from '@stock/application/service/OwnerChange';
import { ensureOwnerWritable } from '@stock/application/service/OwnerWritable';
import { assertItemShoppingList } from '@stock/application/service/ShoppingListAccess';
import { assertStockLimits, loadCatalogRefs } from '@stock/application/service/StockRules';
import {
  loadCatalogLookup,
  StockItemView,
  todayUtc,
  toStockItemView,
} from '@stock/application/service/StockView';
import { RefreshStockEmbeddingUseCase } from '@stock/application/use-case/RefreshStockEmbeddingUseCase';
import { hasOwnerAccess } from '@stock/domain/entity/OwnerAccess';
import {
  IShoppingListRepository,
  IStockCatalogRepository,
  IStockRepository,
} from '@stock/domain/repository';
import { quantityError } from '@stock/domain/service/StockQuantity';

export class UpdateStockItemUseCase implements UseCaseWithParams<
  UpdateStockItemInput,
  StockItemView
> {
  constructor(
    @Inject('IStockRepository')
    private readonly stockRepository: IStockRepository,
    @Inject('IStockCatalogRepository')
    private readonly catalogRepository: IStockCatalogRepository,
    private readonly refreshEmbedding: RefreshStockEmbeddingUseCase,
    @Inject('IShoppingListRepository')
    private readonly listRepository: IShoppingListRepository,
  ) {}

  async execute(params: UpdateStockItemInput): Promise<StockItemView> {
    const input = validate(UpdateStockItemSchema, params);

    const item = await this.stockRepository.findById(input.id);

    // 404 first (never confirm another owner's ids), then 403 for the destination owner.
    if (!item || !hasOwnerAccess(input.accessibleOwners, item)) {
      throw new NotFoundException();
    }

    ensureOwnerWritable(input.accessibleOwners, item);

    const target = {
      owner: input.owner ?? item.owner,
      ownerId: input.ownerId ?? item.ownerId,
    };
    const ownerChanged = target.owner !== item.owner || target.ownerId !== item.ownerId;

    if (ownerChanged) {
      if (!hasOwnerAccess(input.accessibleOwners, target)) {
        throw new ForbiddenException('Owner not accessible');
      }

      ensureOwnerWritable(input.accessibleOwners, target);
    }

    const unit = input.unit ?? item.unit;

    // FR 7: kg and L are not convertible into each other.
    if (unit !== item.unit && item.lots.some((lot) => lot.quantity > 0)) {
      throw new UnprocessableEntityException('Change the unit only when the item is empty');
    }

    const stockOnly = input.stockOnly ?? item.stockOnly;
    const clearLimits = input.stockOnly === true && !item.stockOnly;
    // `undefined` keeps the stored value, `null` clears it; switching to stock-only clears both (FR 18).
    function keep(provided: null | number | undefined, current: number | undefined) {
      return provided === undefined ? (current ?? null) : provided;
    }
    const minQuantity = clearLimits ? null : keep(input.minQuantity, item.minQuantity);
    const idealQuantity = clearLimits ? null : keep(input.idealQuantity, item.idealQuantity);

    assertStockLimits({ idealQuantity, minQuantity, stockOnly, unit });

    // Spec 117 FR 10: the step follows the unit rules (whole numbers for `unit`).
    const stepError =
      typeof input.quickStep === 'number' ? quantityError(unit, input.quickStep) : undefined;

    if (stepError) {
      throw new UnprocessableEntityException(stepError);
    }

    let categoryId = input.categoryId;
    let locationId = input.locationId;
    let shoppingListId = input.shoppingListId;

    if (ownerChanged) {
      const [source, destination] = await Promise.all([
        loadCatalogLookup(this.catalogRepository, [item]),
        loadCatalogLookup(this.catalogRepository, [target]),
      ]);
      const plan = planOwnerChange(item, source, destination);

      categoryId = categoryId === undefined ? plan.categoryId : categoryId;
      locationId = locationId === undefined ? plan.locationId : locationId;
      shoppingListId = shoppingListId === undefined ? plan.shoppingListId : shoppingListId;
    }

    // Spec 118 FR 6: a stock-only item keeps no list (switching to it clears the pointer).
    if (typeof shoppingListId === 'string') {
      await assertItemShoppingList(this.listRepository, target, shoppingListId, stockOnly);
    } else if (stockOnly && item.shoppingListId) {
      shoppingListId = null;
    }

    await loadCatalogRefs(this.catalogRepository, target, { categoryId, locationId });

    const updated = await this.stockRepository.update({
      barcode: input.barcode,
      brand: input.brand,
      categoryId,
      description: input.description,
      estimatedUnitPriceCents: input.estimatedUnitPriceCents,
      id: input.id,
      idealQuantity: clearLimits || input.idealQuantity !== undefined ? idealQuantity : undefined,
      locationId,
      minQuantity: clearLimits || input.minQuantity !== undefined ? minQuantity : undefined,
      notes: input.notes,
      openedShelfLifeDays: input.openedShelfLifeDays,
      owner: ownerChanged ? target.owner : undefined,
      ownerId: ownerChanged ? target.ownerId : undefined,
      quickStep: input.quickStep,
      shoppingListId,
      stockOnly: input.stockOnly,
      unit: input.unit,
      warnDaysClosed: input.warnDaysClosed,
      warnDaysOpened: input.warnDaysOpened,
    });

    if (input.description !== undefined || input.brand !== undefined) {
      void this.refreshEmbedding.execute({ id: updated.id }).catch(() => undefined);
    }

    return toStockItemView(
      updated,
      todayUtc(),
      await loadCatalogLookup(this.catalogRepository, [target]),
    );
  }
}
