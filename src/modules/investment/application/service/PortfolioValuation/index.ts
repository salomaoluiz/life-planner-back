import { AssetEntity } from '@investment/domain/entity/AssetEntity';
import { FixedIncomeData } from '@investment/domain/entity/FixedIncomeEntity';
import { OperationEntity } from '@investment/domain/entity/OperationEntity';
import { ValuationEntity } from '@investment/domain/entity/ValuationEntity';
import { InvestmentAssetClass, InvestmentOperationType } from '@investment/domain/enum';
import { unitStepOf } from '@investment/domain/service/CorporateEventMath';
import { latestOnOrBefore } from '@investment/domain/service/DatedSeries';
import { calculateTitle } from '@investment/domain/service/FixedIncomeCalculator';
import { averageFxCost, splitFxResult } from '@investment/domain/service/FxResultSplit';
import { IndexSeriesData } from '@investment/domain/service/IndexSeries';
import {
  calculatePosition,
  PositionResult,
  toPositionOperation,
} from '@investment/domain/service/PositionCalculator';
import { Decimal8 } from '@shared/infra/decimal';

import { toCalcInput } from '../FixedIncomeView';

// Latest known USD-BRL rate per day, ascending, and the current one (the latest quote) for dates after the curve.
export interface AssetValue {
  costBrl: number;
  // A USD asset with no rate to convert it: its numbers are zero and the asset counts as "without value".
  missingFx: boolean;
  operationsWithoutFxRate: number;
  quantityZero: boolean;
  usd: null | UsdValue;
  valueBrl: number;
  valueKind: ValueKind;
}
export interface FxCurve {
  current: null | string;
  rates: { date: string; rate: string }[];
}
export interface UsdValue {
  costUsd: number;
  fxRate: string;
  resultFromAsset: number;
  resultFromFx: number;
  valueUsd: number;
}
export interface ValuationInput {
  asset: AssetEntity;
  // Ascending by date.
  closes: { close: Decimal8; date: string }[];
  fixedIncome: FixedIncomeData | undefined;
  // Spec 113: the stored series calculated titles follow.
  indexes?: IndexSeriesData;
  operations: OperationEntity[];
  // Ascending by date.
  valuations: ValuationEntity[];
}
export type ValueKind = 'COST' | 'FIXED_INCOME_NET' | 'MANUAL' | 'QUOTE';

const EMPTY: AssetValue = {
  costBrl: 0,
  missingFx: false,
  operationsWithoutFxRate: 0,
  quantityZero: true,
  usd: null,
  valueBrl: 0,
  valueKind: 'COST',
};

// Spec 110 FR 6: the position and the value of one asset at the end of `on`. Pure: everything comes in `input`.
export function valueAssetAt(input: ValuationInput, on: string, fx: FxCurve): AssetValue {
  const operations = input.operations.filter((operation) => operation.date <= on);
  const position = positionOf(operations, input.asset.assetClass);
  const calculated = calculatedTotals(input.fixedIncome, operations, on, input.indexes);

  if (calculated) {
    return calculated.gross === 0
      ? EMPTY
      : {
          ...EMPTY,
          costBrl: position.cost,
          quantityZero: false,
          valueBrl: calculated.net,
          valueKind: 'FIXED_INCOME_NET',
        };
  }
  if (position.quantity.isZero()) {
    return EMPTY;
  }

  const price = priceAt(input, operations, on);
  const valueNative = price ? position.quantity.mulToCents(price.unitPrice) : position.cost;
  const kind: ValueKind = price?.kind ?? 'COST';

  if (input.asset.currency !== 'USD') {
    return {
      ...EMPTY,
      costBrl: position.cost,
      quantityZero: false,
      valueBrl: valueNative,
      valueKind: kind,
    };
  }

  return usdValue(operations, position, valueNative, kind, on, fx);
}
// Spec 110 FR 8: sales, fraction sales and redemptions dated in [from, to], in BRL (USD at the rate of the day).
export function realizedInPeriod(
  input: ValuationInput,
  from: string,
  to: string,
  fx: FxCurve,
): { cents: number; sales: number } {
  const operations = input.operations.filter((operation) => operation.date <= to);
  const position = positionOf(operations, input.asset.assetClass);
  const redemptions = input.fixedIncome?.terms != null;
  let cents = 0;
  let sales = 0;

  for (const operation of operations) {
    const sold = position.perOperation.get(operation.id);

    if (!sold || operation.date < from) {
      continue;
    }

    const native = redemptions
      ? (operation.netAmount ?? operation.total) - sold.costRemoved
      : sold.realizedResult;

    if (!operation.fractionOfOperationId) {
      sales += 1;
    }

    cents += input.asset.currency === 'USD' ? convertToBrl(native, rateOf(operation, fx)) : native;
  }

  return { cents, sales };
}

// BRL cents of foreign cents; `null` rate gives 0 (nothing invented). Negative amounts keep their sign.
export function convertToBrl(cents: number, rate: null | string): number {
  if (rate === null) {
    return 0;
  }

  const converted = Decimal8.parse((Math.abs(cents) / 100).toFixed(2)).mulToCents(
    Decimal8.parse(rate),
  );

  return cents < 0 ? -converted : converted;
}

// The estimated gross and net of a calculated title on `on`; one calculation (the view also projects the maturity).
function calculatedTotals(
  data: FixedIncomeData | undefined,
  operations: OperationEntity[],
  on: string,
  indexes?: IndexSeriesData,
): { gross: number; net: number } | null {
  if (!data?.terms) {
    return null;
  }

  const { totals } = calculateTitle(
    toCalcInput({ ...data, terms: data.terms }, newestFirst(operations).reverse(), on, indexes),
  );

  return { gross: totals.gross, net: totals.net };
}
function newestFirst(operations: OperationEntity[]): OperationEntity[] {
  return [...operations].sort(
    (a, b) =>
      b.date.localeCompare(a.date) ||
      b.createdAt.getTime() - a.createdAt.getTime() ||
      b.id.localeCompare(a.id),
  );
}
function positionOf(
  operations: OperationEntity[],
  assetClass: InvestmentAssetClass,
): PositionResult {
  return calculatePosition(operations.map(toPositionOperation), { step: unitStepOf(assetClass) });
}
// FR 6: a manual valuation dated on or after the latest close wins; before any close the latest operation price.
export function rateAt(date: string, fx: FxCurve): null | string {
  return latestOnOrBefore(fx.rates, date)?.rate ?? fx.current;
}

function priceAt(
  input: ValuationInput,
  operations: OperationEntity[],
  on: string,
): { kind: ValueKind; unitPrice: Decimal8 } | null {
  const close = latestOnOrBefore(input.closes, on);
  const valuation = latestOnOrBefore(input.valuations, on);

  if (valuation && (!close || valuation.date >= close.date)) {
    return { kind: 'MANUAL', unitPrice: valuation.unitPrice };
  }
  if (close) {
    return { kind: 'QUOTE', unitPrice: close.close };
  }

  const traded = operations
    .filter(
      (operation) =>
        (operation.type === InvestmentOperationType.BUY ||
          operation.type === InvestmentOperationType.SELL) &&
        !operation.fractionOfOperationId,
    )
    .sort((a, b) => a.date.localeCompare(b.date) || a.createdAt.getTime() - b.createdAt.getTime())
    .pop();

  if (!traded) {
    return null;
  }

  return {
    kind: input.asset.ticker ? 'QUOTE' : 'MANUAL',
    unitPrice: traded.unitPrice,
  };
}
function rateOf(operation: OperationEntity, fx: FxCurve): null | string {
  return operation.fxRate ?? rateAt(operation.date, fx);
}
function usdValue(
  operations: OperationEntity[],
  position: PositionResult,
  valueUsd: number,
  kind: ValueKind,
  on: string,
  fx: FxCurve,
): AssetValue {
  const rate = rateAt(on, fx);
  const operationsWithoutFxRate = operations.filter(
    (operation) => operation.type === InvestmentOperationType.BUY && operation.fxRate === null,
  ).length;
  const { averageFxRate } = averageFxCost(
    operations.map((operation) => ({
      createdAt: operation.createdAt,
      date: operation.date,
      fxRate: rateOf(operation, fx),
      id: operation.id,
      total: operation.total,
      type: operation.type,
    })),
    new Map([...position.perOperation].map(([id, sold]) => [id, sold.costRemoved] as const)),
  );

  if (rate === null || averageFxRate === null) {
    return { ...EMPTY, missingFx: true, operationsWithoutFxRate, quantityZero: false };
  }

  const result = splitFxResult({
    averageFxRate,
    costUsd: position.cost,
    currentFxRate: rate,
    marketValueUsd: valueUsd,
  });

  return {
    costBrl: result.costBrl,
    missingFx: false,
    operationsWithoutFxRate,
    quantityZero: false,
    usd: {
      costUsd: position.cost,
      fxRate: rate,
      resultFromAsset: result.resultBrlFromAsset,
      resultFromFx: result.resultBrlFromFx,
      valueUsd,
    },
    valueBrl: result.marketValueBrl,
    valueKind: kind,
  };
}
