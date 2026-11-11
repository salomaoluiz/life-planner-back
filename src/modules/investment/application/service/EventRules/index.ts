import { BadRequestException } from '@nestjs/common';

import {
  OperationWriteResult,
  readWriteResult,
  toPositionException,
} from '@investment/application/service/OperationRules';
import { QuoteContext } from '@investment/application/service/QuoteContext';
import { AssetEntity } from '@investment/domain/entity/AssetEntity';
import { OperationEntity } from '@investment/domain/entity/OperationEntity';
import { InvestmentAssetClass, InvestmentOperationType } from '@investment/domain/enum';
import { IInvestmentRepository, WriteEventRepositoryParams } from '@investment/domain/repository';
import {
  applyBonus,
  applySplit,
  EventStep,
  UnitStep,
  unitStepOf,
} from '@investment/domain/service/CorporateEventMath';
import {
  averagePriceOf,
  calculatePosition,
  toPositionOperation,
} from '@investment/domain/service/PositionCalculator';
import { Decimal8 } from '@shared/infra/decimal';

export const FIXED_INCOME_EVENTS_MESSAGE = "Corporate events don't apply to fixed income";

export type EventPreview = {
  averagePriceAfter: null | string;
  averagePriceBefore: null | string;
} & EventStep;
export interface PreviewEvent {
  bonusPercent: Decimal8 | null;
  bonusUnitCost: Decimal8 | null;
  ratioFrom: Decimal8 | null;
  ratioTo: Decimal8 | null;
  // The data-com: the event applies to the position at the end of that day.
  recordDate: string;
  type: InvestmentOperationType;
}

// Spec 108 FR 2: events are allowed on every class except fixed income.
export function assertEventsAllowed(asset: Pick<AssetEntity, 'assetClass'>): void {
  if (asset.assetClass === InvestmentAssetClass.FIXED_INCOME) {
    throw new BadRequestException(FIXED_INCOME_EVENTS_MESSAGE);
  }
}

// The event in one database transaction (the position re-run is inside), then read back with its numbers.
export async function persistEvent(
  repository: IInvestmentRepository,
  asset: Pick<AssetEntity, 'id'>,
  draft: WriteEventRepositoryParams,
  context?: QuoteContext,
): Promise<OperationWriteResult> {
  let operationId: string;

  try {
    operationId = await repository.writeEvent(draft);
  } catch (error) {
    throw toPositionException(error);
  }

  return readWriteResult(repository, asset.id, operationId, context);
}

// Spec 108 FR 12, 27: what the event does to the position held at the end of the data-com, computed on read with the
// current operations. Null when no shares are held that day (FR 13).
export function previewEvent(
  operations: OperationEntity[],
  assetClass: InvestmentAssetClass,
  event: PreviewEvent,
): EventPreview | null {
  const step = unitStepOf(assetClass);
  const position = calculatePosition(
    operations
      .filter((operation) => operation.date <= event.recordDate)
      .map((operation) => toPositionOperation(operation)),
    { step },
  );

  if (!position.quantity.isPositive()) {
    return null;
  }

  const applied = applyEvent(event, position.quantity, position.cost, step);

  return applied
    ? {
        ...applied,
        averagePriceAfter: averagePriceOf(applied.costAfter, applied.quantityAfter),
        averagePriceBefore: averagePriceOf(applied.costBefore, applied.quantityBefore),
      }
    : null;
}

function applyEvent(
  event: PreviewEvent,
  quantity: Decimal8,
  cost: number,
  step: UnitStep,
): EventStep | null {
  if (event.type === InvestmentOperationType.BONUS) {
    return event.bonusPercent
      ? applyBonus({
          cost,
          percent: event.bonusPercent,
          quantity,
          step,
          unitCost: event.bonusUnitCost,
        })
      : null;
  }

  return event.ratioFrom && event.ratioTo
    ? applySplit({ cost, quantity, ratioFrom: event.ratioFrom, ratioTo: event.ratioTo, step })
    : null;
}
