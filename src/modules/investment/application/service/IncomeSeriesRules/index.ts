import { UnprocessableEntityException } from '@nestjs/common';

import { positionAt } from '@investment/application/service/IncomeRules';
import { AssetDetail } from '@investment/domain/entity/AssetEntity';
import { IncomeSeriesEntity, OccurrenceInsert } from '@investment/domain/entity/IncomeSeriesEntity';
import {
  IncomeSeriesEndReason,
  InvestmentIncomeType,
  InvestmentOperationType,
} from '@investment/domain/enum';
import { planOccurrences } from '@investment/domain/service/IncomeSeriesPositions';
import {
  exDateOf,
  IncomeSeriesFrequency,
  IncomeSeriesRule,
  INTERVAL_LIMITS,
  isIntervalAllowed,
  lastDayOfMonth,
  MAX_OCCURRENCES_PER_CREATE,
  occurrenceDate,
  occurrencesBetween,
} from '@investment/domain/service/IncomeSeriesSchedule';

// Enough to count any backfill before the 600 limit answers 422 (a daily series from the 1900s is ~45k).
const COUNT_LIMIT = 100_000;

export interface SeriesDraft {
  amountPerUnit: string;
  endDate: null | string;
  exDateOffsetDays: null | number;
  firstNumber: number;
  firstPaymentDate: string;
  frequency: IncomeSeriesFrequency;
  type: InvestmentIncomeType;
}
export interface SeriesPlanResult {
  count: number;
  ended?: { endedAt: string; endReason: IncomeSeriesEndReason };
  endsAt: null | string;
  insert: OccurrenceInsert[];
  lastNumber: number;
}

// Spec 114: 422 with the range message of the unit.
export function assertFrequencyAllowed(frequency: IncomeSeriesFrequency): void {
  if (!isIntervalAllowed(frequency.unit, frequency.interval)) {
    throw new UnprocessableEntityException(
      `Interval must be between 1 and ${INTERVAL_LIMITS[frequency.unit]} for ${frequency.unit}`,
    );
  }
}
export function draftOf(series: IncomeSeriesEntity): SeriesDraft {
  return {
    amountPerUnit: series.amountPerUnit,
    endDate: series.endDate,
    exDateOffsetDays: series.exDateOffsetDays,
    firstNumber: series.firstNumber,
    firstPaymentDate: series.firstPaymentDate,
    frequency: series.frequency,
    type: series.type,
  };
}
export function firstBuyDate(asset: AssetDetail): null | string {
  const dates = asset.operations
    .filter((operation) => operation.type === InvestmentOperationType.BUY)
    .map((operation) => operation.date)
    .sort();

  return dates[0] ?? null;
}
// Date of the next occurrence after the last generated one, or null when the series is over (FR 8, 13).
export function nextPaymentDateOf(series: IncomeSeriesEntity): null | string {
  if (series.endedAt) {
    return null;
  }

  const next = occurrenceDate(ruleOf(series), series.lastGeneratedNumber - series.firstNumber + 2);

  return series.endDate && next > series.endDate ? null : next;
}
export function ruleOf(draft: SeriesDraft): IncomeSeriesRule {
  return {
    endDate: draft.endDate,
    exDateOffsetDays: draft.exDateOffsetDays,
    firstNumber: draft.firstNumber,
    firstPaymentDate: draft.firstPaymentDate,
    frequency: draft.frequency,
  };
}

// FR 10-13, 15, 16: the occurrences of a series from number `afterNumber + 1` up to the end of the current month,
// with the position at each ex-date. `markPast` creates the ones before today as received.
export function planSeries(params: {
  afterNumber: number;
  asset: AssetDetail;
  draft: SeriesDraft;
  markPast: boolean;
  today: string;
}): SeriesPlanResult {
  const { afterNumber, asset, draft, markPast, today } = params;
  const rule = ruleOf(draft);
  const horizon = lastDayOfMonth(today);
  const firstK = afterNumber - draft.firstNumber + 2;
  const candidates = occurrencesBetween(rule, occurrenceDate(rule, firstK), horizon, COUNT_LIMIT);
  const plan = planOccurrences({
    amountPerUnit: draft.amountPerUnit,
    assetClass: asset.assetClass,
    occurrences: candidates,
    positionAt: (date) => positionAt(asset.operations, asset.assetClass, date),
    type: draft.type,
  });
  const insert: OccurrenceInsert[] = plan.items.map((item) => ({
    exDate: item.exDate,
    netAmount: item.netAmount,
    number: item.number,
    paymentDate: item.paymentDate,
    quantity: item.quantity,
    received: markPast && item.paymentDate < today,
  }));
  const lastNumber = plan.endsAt
    ? (insert[insert.length - 1]?.number ?? afterNumber)
    : (candidates[candidates.length - 1]?.number ?? afterNumber);
  const result: SeriesPlanResult = {
    count: candidates.length,
    endsAt: plan.endsAt,
    insert,
    lastNumber,
  };

  if (plan.endsAt) {
    result.ended = { endedAt: plan.endsAt, endReason: IncomeSeriesEndReason.POSITION_ZERO };
  } else if (draft.endDate) {
    const next = occurrenceDate(rule, lastNumber - draft.firstNumber + 2);

    if (next > draft.endDate) {
      result.ended = { endedAt: draft.endDate, endReason: IncomeSeriesEndReason.END_DATE };
    }
  }

  return result;
}
// FR 12: the first occurrence needs a position at its ex-date.
export interface IncomeSeriesView {
  nextPaymentDate: null | string;
  series: IncomeSeriesEntity;
}

export function assertMaxOccurrences(count: number): void {
  if (count > MAX_OCCURRENCES_PER_CREATE) {
    throw new UnprocessableEntityException({
      code: 'TOO_MANY_OCCURRENCES',
      details: { count, max: MAX_OCCURRENCES_PER_CREATE },
      message: `A series creates at most ${MAX_OCCURRENCES_PER_CREATE} occurrences at once`,
    });
  }
}
export function assertPositionAtStart(asset: AssetDetail, draft: SeriesDraft): void {
  const exDate = exDateOf(draft.firstPaymentDate, draft.exDateOffsetDays);

  if (positionAt(asset.operations, asset.assetClass, exDate).isZero()) {
    throw new UnprocessableEntityException({
      code: 'NO_POSITION_AT_START',
      details: { firstBuyDate: firstBuyDate(asset) },
      message: 'There is no position at the ex-date of the first occurrence',
    });
  }
}
export function toSeriesView(series: IncomeSeriesEntity): IncomeSeriesView {
  return { nextPaymentDate: nextPaymentDateOf(series), series };
}
