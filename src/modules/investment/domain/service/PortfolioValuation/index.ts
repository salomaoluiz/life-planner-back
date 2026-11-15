import { AssetEntity } from '@investment/domain/entity/AssetEntity';
import { FixedIncomeData } from '@investment/domain/entity/FixedIncomeEntity';
import { OperationEntity } from '@investment/domain/entity/OperationEntity';
import { ValuationEntity } from '@investment/domain/entity/ValuationEntity';
import { InvestmentOperationType } from '@investment/domain/enum';
import { unitStepOf } from '@investment/domain/service/CorporateEventMath';
import { calculateTitle } from '@investment/domain/service/FixedIncomeCalculator';
import { toCalcInput } from '@investment/domain/service/FixedIncomeCalculator/input';
import { averageFxCost, splitFxResult } from '@investment/domain/service/FxResultSplit';
import { calculatePosition, toPositionOperation } from '@investment/domain/service/PositionCalculator';
import { Decimal8 } from '@shared/infra/decimal';

// Spec 110 FR 6: where the value of an open position came from at a date.
export type InvestmentValueKind = 'COST' | 'FIXED_INCOME_NET' | 'MANUAL' | 'QUOTE';
export interface AssetValuationInput {
  asset: AssetEntity;
  // Stored closes, oldest first.
  closes: { date: string; price: Decimal8 }[];
  fixedIncome: FixedIncomeData | null;
  // BRL per USD, oldest first.
  fxHistory: { date: string; rate: string }[];
  operations: OperationEntity[];
  // The latest known rate, used when the date has no stored history (today's quote).
  todayRate: null | string;
  // The client's local date (spec 110 FR 3): the last date that uses `todayRate`.
  todayDate: string;
  // Manual valuations, any order.
  valuations: ValuationEntity[];
}
export interface AssetSnapshot {
  costCents: number;
  openResult: number;
  // Fraction of the cost (0.1315 = 13.15%), 4 places; null at zero cost.
  openResultPercent: null | number;
  quantity: Decimal8;
  // Foreign currency assets only.
  usd: null | {
    averageFxRate: null | string;
    costUsd: number;
    marketValueUsd: number;
    resultFromAsset: number;
    resultFromFx: number;
  };
  valueCents: number;
  valueKind: InvestmentValueKind;
}

const ONE = Decimal8.parse('1');
const RATE_SCALE = 1_000_000n;

// Spec 110 FR 6-7: the position and its values at the end of `date`, computed on read (no I/O).
export function snapshotAt(input: AssetValuationInput, date: string): AssetSnapshot | null {
  const operations = input.operations.filter((operation) => operation.date <= date);
  const position = calculatePosition(operations.map(toPositionOperation), {
    step: unitStepOf(input.asset.assetClass),
  });

  if (position.quantity.isZero()) {
    return null;
  }

  const fixedIncome = input.fixedIncome?.terms
    ? calculateTitle(toCalcInput({ ...input.fixedIncome, terms: input.fixedIncome.terms }, operations, date))
        .totals
    : null;

  if (fixedIncome) {
    const value = fixedIncome.net;

    return snapshotOf(position.cost, value, position.quantity, 'FIXED_INCOME_NET', null);
  }

  const price = priceAt(input, operations, date);
  const quantity = position.quantity;

  if (input.asset.currency !== 'USD') {
    const value = price ? quantity.mulToCents(price.unitPrice) : position.cost;

    return snapshotOf(position.cost, value, quantity, price?.kind ?? 'COST', null);
  }

  const marketValueUsd = price ? quantity.mulToCents(price.unitPrice) : position.cost;
  const costRemoved = new Map(
    [...position.perOperation].map(([id, result]) => [id, result.costRemoved]),
  );
  const { averageFxRate } = averageFxCost(operations, costRemoved);
  const rate = rateAt(input, date);

  if (rate === null) {
    return snapshotOf(position.cost, position.cost, quantity, 'COST', {
      averageFxRate,
      costUsd: position.cost,
      marketValueUsd,
      resultFromAsset: 0,
      resultFromFx: 0,
    });
  }

  const split = averageFxRate
    ? splitFxResult({
        averageFxRate,
        costUsd: position.cost,
        currentFxRate: rate,
        marketValueUsd,
      })
    : null;
  const costCents = split?.costBrl ?? convertCents(position.cost, rate);
  const valueCents = split?.marketValueBrl ?? convertCents(marketValueUsd, rate);

  return snapshotOf(costCents, valueCents, quantity, price?.kind ?? 'COST', {
    averageFxRate,
    costUsd: position.cost,
    marketValueUsd,
    resultFromAsset: split?.resultBrlFromAsset ?? 0,
    resultFromFx: split?.resultBrlFromFx ?? valueCents - costCents,
  });
}

// Spec 110 FR 8: BRL result of the SELL rows (redemptions and fraction sales included) dated in the period.
export function realizedInPeriod(input: AssetValuationInput, from: string, to: string): number {
  const operations = input.operations.filter(
    (operation) => operation.date >= from && operation.date <= to,
  );
  const position = calculatePosition(input.operations.map(toPositionOperation), {
    step: unitStepOf(input.asset.assetClass),
  });

  return operations
    .filter((operation) => operation.type === InvestmentOperationType.SELL)
    .reduce((sum, operation) => {
      const result = position.perOperation.get(operation.id)?.realizedResult ?? 0;

      return sum + (input.asset.currency === 'USD' ? toBrl(result, rateOf(input, operation)) : result);
    }, 0);
}

// Spec 110 FR 6: the latest stored close, else the latest manual valuation, else the operation price, else none.
function priceAt(
  input: AssetValuationInput,
  operations: OperationEntity[],
  date: string,
): null | { kind: InvestmentValueKind; unitPrice: Decimal8 } {
  const close = lastOnOrBefore(input.closes, date);

  if (close && close.price.isPositive()) {
    return { kind: 'QUOTE', unitPrice: close.price };
  }

  const valuation = latest(
    input.valuations.filter((row) => row.date <= date),
    (row) => row.date,
  );

  if (valuation && valuation.unitPrice.isPositive()) {
    return { kind: 'MANUAL', unitPrice: valuation.unitPrice };
  }

  const buy = latest(
    operations.filter(
      (operation) => operation.type === InvestmentOperationType.BUY && operation.quantity.isPositive(),
    ),
    (operation) => operation.date,
  );

  return buy && buy.unitPrice.isPositive() ? { kind: 'MANUAL', unitPrice: buy.unitPrice } : null;
}
function rateAt(input: AssetValuationInput, date: string): null | string {
  if (date >= input.todayDate) {
    return input.todayRate ?? input.fxHistory[input.fxHistory.length - 1]?.rate ?? null;
  }

  return lastOnOrBefore(input.fxHistory, date)?.rate ?? input.todayRate;
}
// The rate of an operation: its own, else the stored rate of its date, else the latest one.
function rateOf(input: AssetValuationInput, operation: OperationEntity): null | string {
  return operation.fxRate ?? lastOnOrBefore(input.fxHistory, operation.date)?.rate ?? input.todayRate;
}
function snapshotOf(
  costCents: number,
  valueCents: number,
  quantity: Decimal8,
  valueKind: InvestmentValueKind,
  usd: AssetSnapshot['usd'],
): AssetSnapshot {
  const openResult = valueCents - costCents;

  return {
    costCents,
    openResult,
    openResultPercent: costCents === 0 ? null : Math.round((openResult / costCents) * 10000) / 10000,
    quantity,
    usd,
    valueCents,
    valueKind,
  };
}
// A USD cents value into BRL cents at `rate` (BRL per USD), rounded half up.
export function convertCents(cents: number, rate: string): number {
  return Number(divRound(BigInt(cents) * rateScaled(rate), RATE_SCALE));
}
function toBrl(cents: number, rate: null | string): number {
  return rate === null ? 0 : convertCents(cents, rate);
}
function rateScaled(rate: string): bigint {
  const [integer, fraction = ''] = rate.split('.');

  return BigInt(integer) * RATE_SCALE + BigInt(fraction.padEnd(6, '0').slice(0, 6));
}
function divRound(numerator: bigint, denominator: bigint): bigint {
  const negative = numerator < 0n !== denominator < 0n;
  const n = numerator < 0n ? -numerator : numerator;
  const d = denominator < 0n ? -denominator : denominator;
  const quotient = (n * 2n + d) / (d * 2n);

  return negative ? -quotient : quotient;
}
function lastOnOrBefore<T extends { date: string }>(rows: T[], date: string): T | undefined {
  const eligible = rows
    .filter((row) => row.date <= date)
    .sort((a, b) => a.date.localeCompare(b.date));

  return eligible[eligible.length - 1];
}
function latest<T>(rows: T[], key: (row: T) => string): T | undefined {
  const sorted = [...rows].sort((a, b) => key(a).localeCompare(key(b)));

  return sorted[sorted.length - 1];
}
