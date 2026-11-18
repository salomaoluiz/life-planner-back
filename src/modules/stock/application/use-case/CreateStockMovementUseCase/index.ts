import {
  ConflictException,
  Inject,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';

import { UseCaseWithParams } from '@shared/application/use-case/types';
import { validate } from '@shared/infra/validation';
import {
  CreateStockMovementInput,
  CreateStockMovementSchema,
} from '@stock/application/dto/StockMovement';
import { ensureOwnerWritable } from '@stock/application/service/OwnerWritable';
import {
  loadCatalogLookup,
  StockItemView,
  todayUtc,
  toStockItemView,
} from '@stock/application/service/StockView';
import { hasOwnerAccess } from '@stock/domain/entity/OwnerAccess';
import StockEntity from '@stock/domain/entity/StockEntity';
import StockLotEntity from '@stock/domain/entity/StockLotEntity';
import StockMovementEntity, {
  StockMovementReasons,
  StockMovementTypes,
} from '@stock/domain/entity/StockMovementEntity';
import {
  IStockCatalogRepository,
  IStockRepository,
  MovementOperation,
} from '@stock/domain/repository';
import { planConsumeWithChoice } from '@stock/domain/service/ExpiredLotChoice';
import {
  defaultOpenLot,
  findEntryLot,
  latestClosedLot,
  planConsume,
  planOpen,
} from '@stock/domain/service/LotAllocation';
import { fromMilli, quantityError, toMilli } from '@stock/domain/service/StockQuantity';

export interface CreateStockMovementOutput {
  item: StockItemView;
  movements: StockMovementEntity[];
}

type Movement = ReturnType<typeof CreateStockMovementSchema.parse>;

function assertPrecision(item: StockEntity, quantity: number): void {
  const error = quantityError(item.unit, quantity);

  if (error) {
    throw new UnprocessableEntityException(error);
  }
}
function legacyConsume(lots: StockLotEntity[], quantity: number, shelfLifeDays?: number) {
  const steps = planConsume(lots, quantity, shelfLifeDays);

  return steps && { consumes: steps, discards: [] };
}
function lotOf(item: StockEntity, lotId: string): StockLotEntity {
  const lot = item.lots.find((candidate) => candidate.id === lotId);

  if (!lot) {
    throw new NotFoundException('Lot not found');
  }

  return lot;
}
function minus(total: number, taken: number) {
  return fromMilli(toMilli(total) - toMilli(taken));
}

// Spec 116 FR 8-17. Runs inside the item lock with every lot, so the plan always starts from committed data.
export class CreateStockMovementUseCase implements UseCaseWithParams<
  CreateStockMovementInput,
  CreateStockMovementOutput
> {
  constructor(
    @Inject('IStockRepository')
    private readonly stockRepository: IStockRepository,
    @Inject('IStockCatalogRepository')
    private readonly catalogRepository: IStockCatalogRepository,
  ) {}

  async execute(params: CreateStockMovementInput): Promise<CreateStockMovementOutput> {
    const input = validate(CreateStockMovementSchema, params);
    const found = await this.stockRepository.findById(input.itemId);

    if (!found || !hasOwnerAccess(input.accessibleOwners, found)) {
      throw new NotFoundException();
    }

    ensureOwnerWritable(input.accessibleOwners, found);

    if (input.expiredLots !== undefined && input.type !== 'CONSUME') {
      throw new UnprocessableEntityException('expiredLots only applies to CONSUME');
    }

    const today = input.today ?? todayUtc();
    // Throwing inside the planner aborts the transaction: a refused movement writes nothing.
    const result = await this.stockRepository.applyMovement(
      input.itemId,
      input.userId,
      (item) => plan(input, item, today),
      { clientId: input.clientId, gestureId: input.gestureId },
    );

    if (!result) {
      throw new NotFoundException();
    }

    return {
      item: toStockItemView(
        result.item,
        today,
        await loadCatalogLookup(this.catalogRepository, [result.item]),
      ),
      movements: result.movements,
    };
  }
}

function plan(movement: Movement, item: StockEntity, today: Date): MovementOperation[] {
  const note = movement.note;

  switch (movement.type) {
    case 'ADJUST': {
      assertPrecision(item, movement.countedQuantity);

      // Default lot: the one with the most quantity (ties by id).
      const lot = movement.lotId
        ? lotOf(item, movement.lotId)
        : [...item.lots]
            .filter((candidate) => candidate.quantity > 0)
            .sort((a, b) => b.quantity - a.quantity || a.id.localeCompare(b.id))[0];
      const delta = fromMilli(toMilli(movement.countedQuantity) - toMilli(lot?.quantity ?? 0));

      if (delta === 0) {
        return [];
      }

      const adjust = { note, quantity: delta, type: StockMovementTypes.ADJUST };

      return [
        lot
          ? {
              lot: { id: lot.id },
              movement: adjust,
              update: { quantity: movement.countedQuantity },
            }
          : { lot: { create: { quantity: movement.countedQuantity } }, movement: adjust },
      ];
    }
    case 'CONSUME': {
      assertPrecision(item, movement.quantity);

      const lots = movement.lotId ? [lotOf(item, movement.lotId)] : item.lots;
      // Spec 117 FR 25: an explicit choice decides which lots are touched; without one the 116 rule stands (open
      // lots first, then by expiration, expired lots included), so 116 clients behave as before.
      const steps = movement.expiredLots
        ? planConsumeWithChoice(lots, movement.quantity, movement.expiredLots, item, today)
        : legacyConsume(lots, movement.quantity, item.openedShelfLifeDays);

      if (!steps) {
        throw new ConflictException('Not enough quantity');
      }

      return [
        ...steps.discards.map((step) => ({
          lot: { id: step.lotId },
          movement: {
            note,
            quantity: -step.quantity,
            reason: StockMovementReasons.EXPIRED,
            type: StockMovementTypes.DISCARD,
          },
          update: { quantity: minus(lotOf(item, step.lotId).quantity, step.quantity) },
        })),
        ...steps.consumes.map((step) => ({
          lot: { id: step.lotId },
          movement: { note, quantity: -step.quantity, type: StockMovementTypes.CONSUME },
          update: { quantity: minus(lotOf(item, step.lotId).quantity, step.quantity) },
        })),
      ];
    }
    case 'DISCARD': {
      const lot = lotOf(item, movement.lotId);
      const quantity = movement.quantity ?? lot.quantity;

      assertPrecision(item, quantity);

      if (lot.quantity <= 0 || toMilli(quantity) > toMilli(lot.quantity)) {
        throw new ConflictException('Not enough quantity');
      }

      return [
        {
          lot: { id: lot.id },
          movement: {
            note,
            quantity: -quantity,
            reason: movement.reason,
            type: StockMovementTypes.DISCARD,
          },
          update: { quantity: minus(lot.quantity, quantity) },
        },
      ];
    }
    case 'ENTRY': {
      assertPrecision(item, movement.quantity);

      const lot =
        movement.expirationDate === undefined && movement.target === 'LATEST_CLOSED'
          ? latestClosedLot(item.lots)
          : findEntryLot(item.lots, movement.expirationDate);
      const entry = {
        note,
        quantity: movement.quantity,
        reason: movement.reason,
        type: StockMovementTypes.ENTRY,
      };

      return [
        lot
          ? {
              lot: { id: lot.id },
              movement: entry,
              update: { quantity: fromMilli(toMilli(lot.quantity) + toMilli(movement.quantity)) },
            }
          : {
              lot: {
                create: {
                  expirationDate: movement.expirationDate,
                  purchaseDate: movement.purchaseDate ?? today,
                  quantity: movement.quantity,
                },
              },
              movement: entry,
            },
      ];
    }
    case 'OPEN': {
      assertPrecision(item, movement.quantity);

      const lot = movement.lotId ? lotOf(item, movement.lotId) : defaultOpenLot(item.lots);

      if (!lot || lot.quantity <= 0) {
        throw new UnprocessableEntityException('There is no closed lot to open');
      }

      if (lot.openedAt) {
        throw new ConflictException('Lot is already open');
      }

      const { openedQuantity, split } = planOpen(lot, movement.quantity);
      const opened = { note, quantity: openedQuantity, type: StockMovementTypes.OPEN };

      return split
        ? [
            { lot: { id: lot.id }, update: { quantity: minus(lot.quantity, openedQuantity) } },
            {
              lot: {
                create: {
                  expirationDate: lot.expirationDate,
                  openedAt: today,
                  purchaseDate: lot.purchaseDate,
                  quantity: openedQuantity,
                },
              },
              movement: opened,
            },
          ]
        : [{ lot: { id: lot.id }, movement: opened, update: { openedAt: today } }];
    }
  }
}
