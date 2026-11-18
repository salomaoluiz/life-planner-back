import { Inject, NotFoundException, UnprocessableEntityException } from '@nestjs/common';

import { UseCaseWithParams } from '@shared/application/use-case/types';
import { validate } from '@shared/infra/validation';
import {
  SetGestureExpirationInput,
  SetGestureExpirationSchema,
} from '@stock/application/dto/StockGesture';
import { reverseGesture } from '@stock/application/service/GestureChange';
import {
  loadCatalogLookup,
  StockItemView,
  todayUtc,
  toStockItemView,
} from '@stock/application/service/StockView';
import { StockMovementReasons, StockMovementTypes } from '@stock/domain/entity/StockMovementEntity';
import { IStockCatalogRepository, IStockRepository } from '@stock/domain/repository';
import { findEntryLot } from '@stock/domain/service/LotAllocation';
import { fromMilli, toMilli } from '@stock/domain/service/StockQuantity';

// Spec 117 FR 9/27: an ENTRY gesture moves out of its lot into a closed lot with the chosen date, in one
// transaction (undo + new ENTRY). The new movement keeps the gesture id, so it can still be undone.
export class SetGestureExpirationUseCase implements UseCaseWithParams<
  SetGestureExpirationInput,
  StockItemView
> {
  constructor(
    @Inject('IStockRepository')
    private readonly stockRepository: IStockRepository,
    @Inject('IStockCatalogRepository')
    private readonly catalogRepository: IStockCatalogRepository,
  ) {}

  async execute(params: SetGestureExpirationInput): Promise<StockItemView> {
    const input = validate(SetGestureExpirationSchema, params);
    const now = input.now ?? new Date();
    const today = input.today ?? todayUtc();
    const result = await this.stockRepository.applyGestureChange(
      input.gestureId,
      input.userId,
      (context) => {
        if (context.movements.some((movement) => movement.type !== StockMovementTypes.ENTRY)) {
          throw new UnprocessableEntityException('Only an entry can change its expiration');
        }

        const undo = reverseGesture(context, input.accessibleOwners, now);
        const quantity = fromMilli(
          context.movements.reduce((sum, movement) => sum + toMilli(movement.quantity), 0),
        );
        const removed = new Set(undo.deleteLotIds);
        const after = context.item.lots
          .filter((lot) => !removed.has(lot.id))
          .map((lot) => ({
            ...lot,
            quantity:
              undo.lotUpdates.find((update) => update.id === lot.id)?.quantity ?? lot.quantity,
          }));
        const target = findEntryLot(after, input.expirationDate);
        const entry = {
          quantity,
          reason: StockMovementReasons.MANUAL,
          type: StockMovementTypes.ENTRY,
        };

        return {
          create: [
            target
              ? {
                  lot: { id: target.id },
                  movement: entry,
                  update: { quantity: fromMilli(toMilli(target.quantity) + toMilli(quantity)) },
                }
              : {
                  lot: {
                    create: { expirationDate: input.expirationDate, purchaseDate: today, quantity },
                  },
                  movement: entry,
                },
          ],
          deleteLotIds: undo.deleteLotIds,
          lotUpdates: undo.lotUpdates,
        };
      },
    );

    if (!result) {
      throw new NotFoundException();
    }

    return toStockItemView(
      result.item,
      today,
      await loadCatalogLookup(this.catalogRepository, [result.item]),
    );
  }
}
