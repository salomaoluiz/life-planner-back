import { Inject, NotFoundException } from '@nestjs/common';

import { UseCaseWithParams } from '@shared/application/use-case/types';
import { validate } from '@shared/infra/validation';
import { UndoStockGestureInput, UndoStockGestureSchema } from '@stock/application/dto/StockGesture';
import { reverseGesture } from '@stock/application/service/GestureChange';
import {
  loadCatalogLookup,
  StockItemView,
  todayUtc,
  toStockItemView,
} from '@stock/application/service/StockView';
import { IStockCatalogRepository, IStockRepository } from '@stock/domain/repository';

// Spec 117 FR 8/26: deletes the movements of one gesture and restores the lots exactly.
export class UndoStockGestureUseCase implements UseCaseWithParams<
  UndoStockGestureInput,
  StockItemView
> {
  constructor(
    @Inject('IStockRepository')
    private readonly stockRepository: IStockRepository,
    @Inject('IStockCatalogRepository')
    private readonly catalogRepository: IStockCatalogRepository,
  ) {}

  async execute(params: UndoStockGestureInput): Promise<StockItemView> {
    const input = validate(UndoStockGestureSchema, params);
    const now = input.now ?? new Date();
    const result = await this.stockRepository.applyGestureChange(
      input.gestureId,
      input.userId,
      (context) => ({
        create: [],
        ...reverseGesture(context, input.accessibleOwners, now),
      }),
    );

    if (!result) {
      throw new NotFoundException();
    }

    return toStockItemView(
      result.item,
      todayUtc(),
      await loadCatalogLookup(this.catalogRepository, [result.item]),
    );
  }
}
