import { MarketIndexSeries } from '@investment/domain/enum';
import { IndexSeriesData } from '@investment/domain/service/IndexSeries';

// Spec 113 FR 13: the three series a calculated title follows.
export const FOLLOWED_SERIES = [
  MarketIndexSeries.CDI_DAILY,
  MarketIndexSeries.IPCA_EXPECTED_12M,
  MarketIndexSeries.IPCA_MONTHLY,
];

const DAY_MS = 86_400_000;
const SEED_DAYS = 10;

interface Row {
  date: Date;
  series: string;
  value: { toString(): string };
}

// A few days (and the whole month) before `from`, so the value of a day before the first row still carries forward.
export function indexWindowStart(from: string): Date {
  const day = new Date(`${from}T00:00:00.000Z`).getTime();
  const month = new Date(`${from.slice(0, 7)}-01T00:00:00.000Z`).getTime();

  return new Date(Math.min(day - SEED_DAYS * DAY_MS, month));
}
export function toIndexSeriesData(rows: Row[], expectedFallback?: null | Row): IndexSeriesData {
  function only(series: MarketIndexSeries): { date: string; value: number }[] {
    return rows
      .filter((row) => row.series === series)
      .map((row) => ({
        date: row.date.toISOString().slice(0, 10),
        value: Number(row.value.toString()),
      }));
  }

  const expected = only(MarketIndexSeries.IPCA_EXPECTED_12M);

  return {
    cdiDaily: only(MarketIndexSeries.CDI_DAILY),
    ipcaExpected:
      expected.length === 0 && expectedFallback
        ? [
            {
              date: expectedFallback.date.toISOString().slice(0, 10),
              value: Number(expectedFallback.value.toString()),
            },
          ]
        : expected,
    ipcaMonthly: only(MarketIndexSeries.IPCA_MONTHLY),
  };
}
