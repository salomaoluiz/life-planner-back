import { InvestmentFixedIncomeRateMode } from '@investment/domain/enum';
import { businessDays } from '@investment/domain/service/BusinessDayCalendar';
import { latestOnOrBefore } from '@investment/domain/service/DatedSeries';

// Spec 113: the stored market series a calculated title follows, ascending by date, values in % as numbers.
export interface DatedValue {
  date: string;
  value: number;
}
export interface IndexSeriesData {
  // CDI of the day, % per day (SGS 12), one row per business day.
  cdiDaily: DatedValue[];
  // Focus expectation of the IPCA for the next 12 months, % (latest row wins).
  ipcaExpected: DatedValue[];
  // IPCA of the month, %, dated the first day of the month (SGS 433).
  ipcaMonthly: DatedValue[];
}

const BUSINESS_DAYS_PER_YEAR = 252;
const PLACES = 6;

export const EMPTY_INDEXES: IndexSeriesData = { cdiDaily: [], ipcaExpected: [], ipcaMonthly: [] };

// FR 10: product over the business days of [from, to) of 1 + CDI_DAILY x percent. A day without a stored value uses
// the latest one before it; days before the first stored value count as 1.
export function cdiGrowth(
  series: IndexSeriesData,
  from: string,
  to: string,
  cdiPercent: number,
): number {
  const rows = series.cdiDaily;
  let growth = 1;
  let cursor = from;
  let value = latestOnOrBefore(rows, from)?.value ?? null;

  function close(until: string): void {
    if (value !== null && until > cursor) {
      growth *= Math.pow(1 + ((value / 100) * cdiPercent) / 100, businessDays(cursor, until));
    }
  }

  for (let index = firstAfter(rows, from); index < rows.length; index += 1) {
    const row = rows[index] as DatedValue;

    if (row.date >= to) {
      break;
    }

    close(row.date);
    cursor = row.date;
    value = row.value;
  }

  close(to);

  return growth;
}
// FR 10: the annual rate shown for a "% of CDI" entry, `null` without any stored CDI.
export function currentCdiEffective(series: IndexSeriesData, cdiPercent: number): null | string {
  const latest = series.cdiDaily[series.cdiDaily.length - 1];

  if (!latest) {
    return null;
  }

  const daily = 1 + ((latest.value / 100) * cdiPercent) / 100;

  return ((Math.pow(daily, BUSINESS_DAYS_PER_YEAR) - 1) * 100).toFixed(PLACES);
}
// The annual rate shown for an "IPCA + x" entry: the Focus expectation with the spread, `null` without one.
export function currentIpcaEffective(series: IndexSeriesData, spread: number): null | string {
  const expected = series.ipcaExpected[series.ipcaExpected.length - 1];

  return expected
    ? (((1 + expected.value / 100) * (1 + spread / 100) - 1) * 100).toFixed(PLACES)
    : null;
}
// Whether the series a rate mode needs are stored (`PREFIXED` needs none).
export function hasIndexFor(series: IndexSeriesData, mode: InvestmentFixedIncomeRateMode): boolean {
  switch (mode) {
    case InvestmentFixedIncomeRateMode.CDI_PERCENT:
      return series.cdiDaily.length > 0;
    case InvestmentFixedIncomeRateMode.IPCA_PLUS:
      return series.ipcaMonthly.length > 0 || series.ipcaExpected.length > 0;
    case InvestmentFixedIncomeRateMode.PREFIXED:
      return true;
  }
}
// FR 11: per month, (1 + IPCA_m)^(n/du_m) x (1 + spread)^(n/252) with n the business days of the month inside
// [from, to) and du_m all of its business days. A month without a published IPCA uses the monthly equivalent of
// the latest Focus expectation; without either, the spread alone.
export function ipcaPlusGrowth(
  series: IndexSeriesData,
  from: string,
  to: string,
  spread: number,
): number {
  const fallback = series.ipcaExpected[series.ipcaExpected.length - 1];
  const published = new Map(series.ipcaMonthly.map((row) => [row.date, row.value]));
  let growth = 1;
  let counted = 0;
  let month = `${from.slice(0, 7)}-01`;

  while (month < to) {
    const next = nextMonth(month);
    const lo = from > month ? from : month;
    const hi = to < next ? to : next;
    const days = businessDays(lo, hi);

    if (days > 0) {
      const ipca = published.get(month) ?? (fallback ? monthlyOf(fallback.value) : 0);

      growth *= Math.pow(1 + ipca / 100, days / businessDays(month, next));
      counted += days;
    }

    month = next;
  }

  return growth * Math.pow(1 + spread / 100, counted / BUSINESS_DAYS_PER_YEAR);
}

// Index of the first row dated after `date`.
function firstAfter(rows: DatedValue[], date: string): number {
  let low = 0;
  let high = rows.length;

  while (low < high) {
    const middle = (low + high) >> 1;

    if ((rows[middle] as DatedValue).date <= date) {
      low = middle + 1;
    } else {
      high = middle;
    }
  }

  return low;
}
// % of the month that, compounded 12 times, gives the expected % of 12 months.
function monthlyOf(expected12m: number): number {
  return (Math.pow(1 + expected12m / 100, 1 / 12) - 1) * 100;
}
function nextMonth(firstDay: string): string {
  const year = Number(firstDay.slice(0, 4));
  const month = Number(firstDay.slice(5, 7));

  return month === 12 ? `${year + 1}-01-01` : `${year}-${String(month + 1).padStart(2, '0')}-01`;
}
