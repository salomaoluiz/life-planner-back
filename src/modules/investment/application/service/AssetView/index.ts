import { AssetDetail, AssetEntity, AssetListRow } from '@investment/domain/entity/AssetEntity';
import { OperationEntity } from '@investment/domain/entity/OperationEntity';
import { ValuationEntity } from '@investment/domain/entity/ValuationEntity';
import { calculatePosition, PositionResult } from '@investment/domain/service/PositionCalculator';
import { Decimal8 } from '@shared/infra/decimal';

export interface AssetDetailView extends AssetView {
  operations: OperationView[];
  valuations: ValuationEntity[];
}
export interface AssetPosition {
  averagePrice: null | string;
  cost: number;
  currentUnitPrice: Decimal8 | null;
  currentValue: null | number;
  currentValueDate: null | string;
  openResult: null | number;
  // Fraction of the cost (0.0721 = 7.21%), 4 places; null at zero cost.
  openResultPercent: null | number;
  quantity: Decimal8;
  realizedResult: number;
}
export interface AssetView {
  asset: AssetEntity;
  operationCount: number;
  position: AssetPosition;
}
export interface OperationView {
  costRemoved: null | number;
  operation: OperationEntity;
  realizedResult: null | number;
}

// The list shape of a detail: only the latest valuation (newest first in the detail).
export function detailToListRow(detail: AssetDetail): AssetListRow {
  const { valuations, ...rest } = detail;

  return { ...rest, latestValuation: latestOf(valuations) };
}

// Spec 102 FR 15, 16, 25: the position is derived on read from the operations and the latest valuation.
export function toAssetDetailView(detail: AssetDetail): AssetDetailView {
  const result = positionOf(detail.operations);
  const { operations, valuations, ...asset } = detail;

  return {
    asset,
    operationCount: operations.length,
    operations: operations.map((operation) => {
      const sell = result.perOperation.get(operation.id);

      return {
        costRemoved: sell?.costRemoved ?? null,
        operation,
        realizedResult: sell?.realizedResult ?? null,
      };
    }),
    position: toPosition(result, latestOf(valuations)),
    valuations,
  };
}
export function toAssetView(row: AssetListRow): AssetView {
  const { latestValuation, operations, ...asset } = row;

  return {
    asset,
    operationCount: operations.length,
    position: toPosition(positionOf(operations), latestValuation),
  };
}

// Valuations come newest first from the repository; the latest by date is the first one.
function latestOf(valuations: ValuationEntity[]): null | ValuationEntity {
  return valuations.reduce<null | ValuationEntity>(
    (latest, valuation) => (latest === null || valuation.date > latest.date ? valuation : latest),
    null,
  );
}
function positionOf(operations: OperationEntity[]): PositionResult {
  return calculatePosition(
    operations.map((operation) => ({
      createdAt: operation.createdAt,
      date: operation.date,
      id: operation.id,
      quantity: operation.quantity,
      total: operation.total,
      type: operation.type,
    })),
  );
}
function toPosition(result: PositionResult, valuation: null | ValuationEntity): AssetPosition {
  const currentValue = valuation ? result.quantity.mulToCents(valuation.unitPrice) : null;
  const openResult = currentValue === null ? null : currentValue - result.cost;

  return {
    averagePrice: result.averagePrice,
    cost: result.cost,
    currentUnitPrice: valuation?.unitPrice ?? null,
    currentValue,
    currentValueDate: valuation?.date ?? null,
    openResult,
    openResultPercent:
      openResult === null || result.cost === 0
        ? null
        : Math.round((openResult / result.cost) * 10000) / 10000,
    quantity: result.quantity,
    realizedResult: result.realizedResult,
  };
}
