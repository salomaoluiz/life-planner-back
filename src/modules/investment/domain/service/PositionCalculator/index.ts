import { EventData, OperationEntity } from '@investment/domain/entity/OperationEntity';
import { InvestmentOperationType, isEventType } from '@investment/domain/enum';
import {
  applyBonus,
  applySplit,
  EventStep,
  UnitStep,
} from '@investment/domain/service/CorporateEventMath';
import { Decimal8, roundDiv } from '@shared/infra/decimal';

export interface OperationResult {
  costRemoved: number;
  realizedResult: number;
}
export interface PendingFraction {
  cost: number;
  date: string;
  eventId: string;
  quantity: Decimal8;
}
export interface PositionOperation {
  createdAt: Date;
  date: string;
  event?: EventData | null;
  // Spec 108 FR 15-17: a SELL linked to the event whose fraction it sells.
  fractionOfOperationId?: null | string;
  id: string;
  quantity: Decimal8;
  total: number;
  type: InvestmentOperationType;
}
export interface PositionOptions {
  step: UnitStep;
}
export interface PositionResult {
  averagePrice: null | string;
  cost: number;
  negativeAt: { date: string; operationId: string } | null;
  // Spec 108 FR 13: the first event dated where no shares are held.
  noPositionAt: { date: string; operationId: string } | null;
  pendingFractions: PendingFraction[];
  perEvent: Map<string, EventStep>;
  perOperation: Map<string, OperationResult>;
  quantity: Decimal8;
  realizedResult: number;
}
export interface Totals {
  feesTotal: number;
  gross: number;
  total: number;
}

export class FeesHigherThanSaleError extends Error {
  constructor() {
    super('Fees are higher than the sale value');
  }
}

// Spec 102 FR 15: processes the operations by date, then creation, then id. Fees enter the cost (BUY total) and the
// average price; a SELL removes the proportional cost and never changes the average.
export function calculatePosition(
  operations: PositionOperation[],
  options: PositionOptions = { step: 'DECIMAL' },
): PositionResult {
  const sorted = [...operations].sort(compareOperations);
  const perOperation = new Map<string, OperationResult>();
  const perEvent = new Map<string, EventStep>();
  const pending = new Map<string, PendingFraction>();
  let quantity = Decimal8.zero();
  let cost = 0;
  let realized = 0;
  function finish(
    negativeAt: PositionResult['negativeAt'],
    noPositionAt: PositionResult['noPositionAt'],
  ): PositionResult {
    return {
      averagePrice: averagePriceOf(cost, quantity),
      cost,
      negativeAt,
      noPositionAt,
      pendingFractions: [...pending.values()],
      perEvent,
      perOperation,
      quantity,
      realizedResult: realized,
    };
  }

  for (const operation of sorted) {
    if (operation.type === InvestmentOperationType.BUY) {
      quantity = quantity.plus(operation.quantity);
      cost += operation.total;
      continue;
    }

    if (isEventType(operation.type) && operation.event) {
      if (quantity.isZero()) {
        return finish(null, { date: operation.date, operationId: operation.id });
      }

      const step = applyEvent(operation.event, quantity, cost, options.step);

      perEvent.set(operation.id, step);
      quantity = step.quantityAfter;
      cost = step.costAfter;

      if (step.fractionQuantity.isPositive()) {
        pending.set(operation.id, {
          cost: step.fractionCost,
          date: operation.date,
          eventId: operation.id,
          quantity: step.fractionQuantity,
        });
      }
      continue;
    }

    if (operation.fractionOfOperationId) {
      const fractionCost = perEvent.get(operation.fractionOfOperationId)?.fractionCost ?? 0;
      const result = operation.total - fractionCost;

      perOperation.set(operation.id, { costRemoved: fractionCost, realizedResult: result });
      realized += result;
      pending.delete(operation.fractionOfOperationId);
      continue;
    }

    if (operation.quantity.compare(quantity) > 0) {
      return finish({ date: operation.date, operationId: operation.id }, null);
    }

    const costRemoved =
      operation.quantity.compare(quantity) === 0
        ? cost
        : Number(roundDiv(BigInt(cost) * operation.quantity.scaled, quantity.scaled));
    const result = operation.total - costRemoved;

    perOperation.set(operation.id, { costRemoved, realizedResult: result });
    realized += result;
    quantity = quantity.minus(operation.quantity);
    cost -= costRemoved;
  }

  return finish(null, null);
}

// The calculator input of a stored operation.
export function toPositionOperation(
  operation: Pick<
    OperationEntity,
    'createdAt' | 'date' | 'event' | 'fractionOfOperationId' | 'id' | 'quantity' | 'total' | 'type'
  >,
): PositionOperation {
  return {
    createdAt: operation.createdAt,
    date: operation.date,
    event: operation.event,
    fractionOfOperationId: operation.fractionOfOperationId,
    id: operation.id,
    quantity: operation.quantity,
    total: operation.total,
    type: operation.type,
  };
}

// Spec 102 FR 14. SELL with fees above the gross value is refused.
export function computeTotals(
  type: InvestmentOperationType,
  quantity: Decimal8,
  unitPrice: Decimal8,
  feeAmounts: number[],
): Totals {
  const gross = quantity.mulToCents(unitPrice);
  const feesTotal = feeAmounts.reduce((sum, amount) => sum + amount, 0);
  const total = type === InvestmentOperationType.BUY ? gross + feesTotal : gross - feesTotal;

  if (total < 0) {
    throw new FeesHigherThanSaleError();
  }

  return { feesTotal, gross, total };
}

// cost / quantity / 100 as an 8-place decimal string; null with no quantity.
function applyEvent(event: EventData, quantity: Decimal8, cost: number, step: UnitStep) {
  return event.kind === 'SPLIT'
    ? applySplit({ cost, quantity, ratioFrom: event.ratioFrom, ratioTo: event.ratioTo, step })
    : applyBonus({ cost, percent: event.percent, quantity, step, unitCost: event.unitCost });
}
function averagePriceOf(cost: number, quantity: Decimal8): null | string {
  if (quantity.isZero()) {
    return null;
  }

  const scaled = roundDiv(BigInt(cost) * 10n ** 16n, quantity.scaled * 100n);

  return Decimal8.fromScaled(scaled).toFixed8();
}
// Same day: BUY/SELL first, then events, then fraction sales (they need the fraction cost of the event).
function compareOperations(a: PositionOperation, b: PositionOperation): number {
  if (a.date !== b.date) {
    return a.date < b.date ? -1 : 1;
  }

  const byGroup = groupOf(a) - groupOf(b);

  if (byGroup !== 0) {
    return byGroup;
  }

  const byCreation = a.createdAt.getTime() - b.createdAt.getTime();

  if (byCreation !== 0) {
    return byCreation;
  }

  return a.id.localeCompare(b.id);
}
function groupOf(operation: PositionOperation): number {
  if (operation.fractionOfOperationId) {
    return 2;
  }

  return isEventType(operation.type) ? 1 : 0;
}
