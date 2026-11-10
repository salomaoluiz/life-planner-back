import { InvestmentOperationType } from '@investment/domain/enum';
import { Decimal8, roundDiv } from '@shared/infra/decimal';

export interface OperationResult {
  costRemoved: number;
  realizedResult: number;
}
export interface PositionOperation {
  createdAt: Date;
  date: string;
  id: string;
  quantity: Decimal8;
  total: number;
  type: InvestmentOperationType;
}
export interface PositionResult {
  averagePrice: null | string;
  cost: number;
  negativeAt: { date: string; operationId: string } | null;
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
export function calculatePosition(operations: PositionOperation[]): PositionResult {
  const sorted = [...operations].sort(compareOperations);
  const perOperation = new Map<string, OperationResult>();
  let quantity = Decimal8.zero();
  let cost = 0;
  let realized = 0;

  for (const operation of sorted) {
    if (operation.type === InvestmentOperationType.BUY) {
      quantity = quantity.plus(operation.quantity);
      cost += operation.total;
      continue;
    }

    if (operation.quantity.compare(quantity) > 0) {
      return {
        averagePrice: averagePriceOf(cost, quantity),
        cost,
        negativeAt: { date: operation.date, operationId: operation.id },
        perOperation,
        quantity,
        realizedResult: realized,
      };
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

  return {
    averagePrice: averagePriceOf(cost, quantity),
    cost,
    negativeAt: null,
    perOperation,
    quantity,
    realizedResult: realized,
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
function averagePriceOf(cost: number, quantity: Decimal8): null | string {
  if (quantity.isZero()) {
    return null;
  }

  const scaled = roundDiv(BigInt(cost) * 10n ** 16n, quantity.scaled * 100n);

  return Decimal8.fromScaled(scaled).toFixed8();
}
function compareOperations(a: PositionOperation, b: PositionOperation): number {
  if (a.date !== b.date) {
    return a.date < b.date ? -1 : 1;
  }

  const byCreation = a.createdAt.getTime() - b.createdAt.getTime();

  if (byCreation !== 0) {
    return byCreation;
  }

  return a.id.localeCompare(b.id);
}
