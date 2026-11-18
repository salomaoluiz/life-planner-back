import { ForbiddenException, Inject, UnprocessableEntityException } from '@nestjs/common';

import { UseCaseWithParams } from '@shared/application/use-case/types';
import { validate } from '@shared/infra/validation';
import {
  CreateStockItemInput,
  CreateStockItemSchema,
} from '@stock/application/dto/CreateStockItem';
import { ensureOwnerWritable } from '@stock/application/service/OwnerWritable';
import { assertStockLimits, loadCatalogRefs } from '@stock/application/service/StockRules';
import {
  loadCatalogLookup,
  StockItemView,
  todayUtc,
  toStockItemView,
} from '@stock/application/service/StockView';
import { RefreshStockEmbeddingUseCase } from '@stock/application/use-case/RefreshStockEmbeddingUseCase';
import { hasOwnerAccess } from '@stock/domain/entity/OwnerAccess';
import { IStockCatalogRepository, IStockRepository } from '@stock/domain/repository';
import { quantityError } from '@stock/domain/service/StockQuantity';

export class CreateStockItemUseCase implements UseCaseWithParams<
  CreateStockItemInput,
  StockItemView
> {
  constructor(
    @Inject('IStockRepository')
    private readonly stockRepository: IStockRepository,
    @Inject('IStockCatalogRepository')
    private readonly catalogRepository: IStockCatalogRepository,
    private readonly refreshEmbedding: RefreshStockEmbeddingUseCase,
  ) {}

  async execute(params: CreateStockItemInput): Promise<StockItemView> {
    const input = validate(CreateStockItemSchema, params);
    const target = { owner: input.owner, ownerId: input.ownerId };

    if (!hasOwnerAccess(input.accessibleOwners, target)) {
      throw new ForbiddenException('Owner not accessible');
    }

    ensureOwnerWritable(input.accessibleOwners, target);

    const precision =
      quantityError(input.unit, input.quantity) ??
      (input.quickStep === undefined ? undefined : quantityError(input.unit, input.quickStep));

    if (precision) {
      throw new UnprocessableEntityException(precision);
    }

    assertStockLimits(input);
    await loadCatalogRefs(this.catalogRepository, target, input);

    const today = input.today ?? todayUtc();
    const item = await this.stockRepository.create({
      barcode: input.barcode,
      brand: input.brand,
      categoryId: input.categoryId,
      description: input.description,
      firstLot:
        input.quantity > 0
          ? {
              expirationDate: input.expirationDate,
              purchaseDate: input.purchaseDate ?? today,
              quantity: input.quantity,
            }
          : undefined,
      idealQuantity: input.idealQuantity,
      locationId: input.locationId,
      minQuantity: input.minQuantity,
      notes: input.notes,
      openedShelfLifeDays: input.openedShelfLifeDays,
      owner: input.owner,
      ownerId: input.ownerId,
      quickStep: input.quickStep,
      stockOnly: input.stockOnly,
      unit: input.unit,
      userId: input.userId,
      warnDaysClosed: input.warnDaysClosed,
      warnDaysOpened: input.warnDaysOpened,
    });

    // After the write and never awaited: the provider must not slow the request (FR 31).
    void this.refreshEmbedding.execute({ id: item.id }).catch(() => undefined);

    return toStockItemView(item, today, await loadCatalogLookup(this.catalogRepository, [target]));
  }
}
