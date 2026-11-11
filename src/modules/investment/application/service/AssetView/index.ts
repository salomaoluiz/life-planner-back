import { AssetDetail, AssetEntity, AssetListRow } from '@investment/domain/entity/AssetEntity';
import { OperationEntity } from '@investment/domain/entity/OperationEntity';
import { ValuationEntity } from '@investment/domain/entity/ValuationEntity';
import { InvestmentAssetClass } from '@investment/domain/enum';
import { unitStepOf } from '@investment/domain/service/CorporateEventMath';
import { averageFxCost, FxResult, splitFxResult } from '@investment/domain/service/FxResultSplit';
import {
  calculatePosition,
  PositionResult,
  toPositionOperation,
} from '@investment/domain/service/PositionCalculator';
import { marketOfClass, PriceSource, resolvePrice } from '@investment/domain/service/QuoteResolver';
import { Decimal8 } from '@shared/infra/decimal';

import { FixedIncomeView, toFixedIncomeView } from '../FixedIncomeView';
import { emptyContext, QuoteContext, quoteKey } from '../QuoteContext';
import { QuoteView, toQuoteView } from '../QuoteView';
import { todayInSaoPaulo } from '../Today';

export interface AssetDetailView extends AssetView {
  operations: OperationView[];
  valuations: ValuationEntity[];
}
export interface AssetMarket {
  // Latest rate used for the BRL numbers of a foreign currency asset.
  fx: { quotedAt: Date; rate: string } | null;
  priceSource: null | PriceSource;
  quote: null | QuoteView;
  // Foreign currency assets only (spec 104 FR 28); `result` is null without an average rate or a current rate.
  usd: null | UsdResult;
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
  // Spec 105: the computed numbers of a calculated title, null for any other asset.
  fixedIncome: FixedIncomeView | null;
  market: AssetMarket;
  operationCount: number;
  position: AssetPosition;
}
export interface OperationView {
  costRemoved: null | number;
  operation: OperationEntity;
  realizedResult: null | number;
}
export interface UsdResult {
  averageFxRate: null | string;
  operationsWithoutFxRate: number;
  result: FxResult | null;
}

// The list shape of a detail: only the latest valuation (newest first in the detail).
export function detailToListRow(detail: AssetDetail): AssetListRow {
  const { valuations, ...rest } = detail;

  return { ...rest, latestValuation: latestOf(valuations) };
}

// Spec 102 FR 15, 16, 25: the position is derived on read from the operations and the latest valuation.
export function toAssetDetailView(
  detail: AssetDetail,
  context: QuoteContext = emptyContext(),
): AssetDetailView {
  const result = positionOf(detail.operations, detail.assetClass);
  const { operations, valuations, ...asset } = detail;
  const latest = latestOf(valuations);
  const fixedIncome = toFixedIncomeView(
    context.fixedIncome.get(asset.id),
    operations,
    todayInSaoPaulo(context.now),
  );

  return {
    asset,
    fixedIncome,
    market: marketOf(asset, operations, result, latest, context),
    operationCount: operations.length,
    operations: operations.map((operation) => {
      const sell = result.perOperation.get(operation.id);

      return {
        costRemoved: sell?.costRemoved ?? null,
        operation,
        realizedResult: sell?.realizedResult ?? null,
      };
    }),
    position: toPosition(result, latest, quoteOf(asset, context), fixedIncome),
    valuations,
  };
}
export function toAssetView(row: AssetListRow, context: QuoteContext = emptyContext()): AssetView {
  const { latestValuation, operations, ...asset } = row;
  const result = positionOf(operations, row.assetClass);
  const fixedIncome = toFixedIncomeView(
    context.fixedIncome.get(asset.id),
    operations,
    todayInSaoPaulo(context.now),
  );

  return {
    asset,
    fixedIncome,
    market: marketOf(asset, operations, result, latestValuation, context),
    operationCount: operations.length,
    position: toPosition(result, latestValuation, quoteOf(asset, context), fixedIncome),
  };
}

// Valuations come newest first from the repository; the latest by date is the first one.
function latestOf(valuations: ValuationEntity[]): null | ValuationEntity {
  return valuations.reduce<null | ValuationEntity>(
    (latest, valuation) => (latest === null || valuation.date > latest.date ? valuation : latest),
    null,
  );
}
function marketOf(
  asset: AssetEntity,
  operations: OperationEntity[],
  result: PositionResult,
  valuation: null | ValuationEntity,
  context: QuoteContext,
): AssetMarket {
  const quote = quoteOf(asset, context);
  const price = resolvePrice({ quote, valuation });
  const fx = context.fx ? { quotedAt: context.fx.quotedAt, rate: context.fx.rate } : null;

  return {
    fx: asset.currency === 'USD' ? fx : null,
    priceSource: price?.source ?? null,
    quote: quote ? toQuoteView(quote, context.now) : null,
    usd: asset.currency === 'USD' ? usdOf(operations, result, price?.unitPrice ?? null, fx) : null,
  };
}
function positionOf(
  operations: OperationEntity[],
  assetClass: InvestmentAssetClass,
): PositionResult {
  return calculatePosition(operations.map(toPositionOperation), { step: unitStepOf(assetClass) });
}
function quoteOf(asset: AssetEntity, context: QuoteContext) {
  const market = marketOfClass(asset.assetClass);

  return market && asset.ticker
    ? (context.quotes.get(quoteKey(market, asset.ticker)) ?? null)
    : null;
}
function toPosition(
  result: PositionResult,
  valuation: null | ValuationEntity,
  quote: ReturnType<typeof quoteOf>,
  fixedIncome: FixedIncomeView | null,
): AssetPosition {
  const price = resolvePrice({ quote, valuation });
  // Spec 105 FR 27: a calculated title is worth its gross on the curve; the net stays in `fixedIncome`.
  const priced = price ? result.quantity.mulToCents(price.unitPrice) : null;
  const currentValue = fixedIncome ? fixedIncome.today.gross : priced;
  const openResult = currentValue === null ? null : currentValue - result.cost;

  return {
    averagePrice: result.averagePrice,
    cost: result.cost,
    currentUnitPrice: fixedIncome ? null : (price?.unitPrice ?? null),
    currentValue,
    currentValueDate: fixedIncome ? todayInSaoPaulo() : (price?.date ?? null),
    openResult,
    openResultPercent:
      openResult === null || result.cost === 0
        ? null
        : Math.round((openResult / result.cost) * 10000) / 10000,
    quantity: result.quantity,
    realizedResult: result.realizedResult,
  };
}
function usdOf(
  operations: OperationEntity[],
  result: PositionResult,
  unitPrice: Decimal8 | null,
  fx: { rate: string } | null,
): UsdResult {
  const costRemoved = new Map(
    [...result.perOperation].map(([id, sell]) => [id, sell.costRemoved] as const),
  );
  const { averageFxRate, operationsWithoutFxRate } = averageFxCost(
    operations.map((operation) => ({
      createdAt: operation.createdAt,
      date: operation.date,
      fxRate: operation.fxRate,
      id: operation.id,
      total: operation.total,
      type: operation.type,
    })),
    costRemoved,
  );
  const marketValueUsd = unitPrice ? result.quantity.mulToCents(unitPrice) : null;

  return {
    averageFxRate,
    operationsWithoutFxRate,
    result:
      averageFxRate && fx && marketValueUsd !== null
        ? splitFxResult({
            averageFxRate,
            costUsd: result.cost,
            currentFxRate: fx.rate,
            marketValueUsd,
          })
        : null,
  };
}
