import { InvestmentFixedIncomeRateMode } from '@investment/domain/enum';
import { businessDays } from '@investment/domain/service/BusinessDayCalendar';

import {
  cdiGrowth,
  currentCdiEffective,
  currentIpcaEffective,
  hasIndexFor,
  IndexSeriesData,
  ipcaPlusGrowth,
} from './index';

const empty: IndexSeriesData = { cdiDaily: [], ipcaExpected: [], ipcaMonthly: [] };

function flatCdi(value: number): IndexSeriesData {
  return { ...empty, cdiDaily: [{ date: '2026-01-02', value }] };
}

describe('cdiGrowth', () => {
  it('SHOULD equal the product of 1 + CDI/100 over the business days WHEN the percent is 100', () => {
    // 2026-03-02 (Mon) to 2026-03-05 (Thu): Mon, Tue, Wed.
    const series: IndexSeriesData = {
      ...empty,
      cdiDaily: [
        { date: '2026-03-02', value: 0.05 },
        { date: '2026-03-03', value: 0.06 },
        { date: '2026-03-04', value: 0.07 },
      ],
    };

    const growth = cdiGrowth(series, '2026-03-02', '2026-03-05', 100);

    expect(growth).toBeCloseTo(1.0005 * 1.0006 * 1.0007, 12);
  });

  it('SHOULD apply the percent to each daily rate WHEN it is 110', () => {
    const growth = cdiGrowth(flatCdi(0.05), '2026-03-02', '2026-03-05', 110);

    expect(growth).toBeCloseTo(Math.pow(1 + (0.05 * 1.1) / 100, 3), 12);
  });

  it('SHOULD carry the previous value forward WHEN a business day has no stored CDI', () => {
    const series: IndexSeriesData = {
      ...empty,
      cdiDaily: [{ date: '2026-03-02', value: 0.05 }],
    };

    expect(cdiGrowth(series, '2026-03-02', '2026-03-06', 100)).toBeCloseTo(Math.pow(1.0005, 4), 12);
  });

  it('SHOULD use the latest stored value for the whole future WHEN the period is after the series', () => {
    const growth = cdiGrowth(flatCdi(0.05), '2027-03-01', '2027-04-01', 100);

    expect(growth).toBeCloseTo(Math.pow(1.0005, businessDays('2027-03-01', '2027-04-01')), 12);
  });

  it('SHOULD give 1 for the days before the first stored value AND for an empty series', () => {
    expect(cdiGrowth(flatCdi(0.05), '2025-03-03', '2025-03-10', 100)).toBe(1);
    expect(cdiGrowth(empty, '2026-03-02', '2026-03-05', 100)).toBe(1);
  });

  it('SHOULD change the factor on the day a new value starts', () => {
    const series: IndexSeriesData = {
      ...empty,
      cdiDaily: [
        { date: '2026-03-02', value: 0.05 },
        { date: '2026-03-04', value: 0.1 },
      ],
    };

    expect(cdiGrowth(series, '2026-03-02', '2026-03-06', 100)).toBeCloseTo(
      1.0005 * 1.0005 * 1.001 * 1.001,
      12,
    );
  });
});

describe('ipcaPlusGrowth', () => {
  it('SHOULD equal (1 + IPCA) x (1 + spread)^(du/252) over a whole published month', () => {
    const series: IndexSeriesData = {
      ...empty,
      ipcaMonthly: [{ date: '2026-03-01', value: 0.5 }],
    };
    const du = businessDays('2026-03-01', '2026-04-01');

    expect(ipcaPlusGrowth(series, '2026-03-01', '2026-04-01', 6)).toBeCloseTo(
      1.005 * Math.pow(1.06, du / 252),
      12,
    );
  });

  it('SHOULD use the monthly equivalent of the latest expectation WHEN the month is not published', () => {
    const series: IndexSeriesData = {
      ...empty,
      ipcaExpected: [
        { date: '2026-02-10', value: 3 },
        { date: '2026-03-10', value: 4.2 },
      ],
    };
    const du = businessDays('2026-05-01', '2026-06-01');

    expect(ipcaPlusGrowth(series, '2026-05-01', '2026-06-01', 6)).toBeCloseTo(
      Math.pow(1.042, 1 / 12) * Math.pow(1.06, du / 252),
      12,
    );
  });

  it('SHOULD use only the spread, never NaN WHEN there is no IPCA and no expectation', () => {
    const du = businessDays('2026-05-01', '2026-06-01');
    const growth = ipcaPlusGrowth(empty, '2026-05-01', '2026-06-01', 6);

    expect(Number.isFinite(growth)).toBe(true);
    expect(growth).toBeCloseTo(Math.pow(1.06, du / 252), 12);
  });

  it('SHOULD pro rate a part of the month by its business days AND chain two months', () => {
    const series: IndexSeriesData = {
      ...empty,
      ipcaMonthly: [
        { date: '2026-03-01', value: 0.5 },
        { date: '2026-04-01', value: 0.4 },
      ],
    };
    const march = businessDays('2026-03-01', '2026-04-01');
    const first = businessDays('2026-03-16', '2026-04-01');
    const aprilPart = businessDays('2026-04-01', '2026-04-10');
    const april = businessDays('2026-04-01', '2026-05-01');
    const expected =
      Math.pow(1.005, first / march) *
      Math.pow(1.004, aprilPart / april) *
      Math.pow(1.06, (first + aprilPart) / 252);

    expect(ipcaPlusGrowth(series, '2026-03-16', '2026-04-10', 6)).toBeCloseTo(expected, 12);
  });
});

describe('current effective rates', () => {
  it('SHOULD annualize the latest daily CDI by the percent (6 places)', () => {
    const expected = ((Math.pow(1 + (0.05 * 1.15) / 100, 252) - 1) * 100).toFixed(6);

    expect(currentCdiEffective(flatCdi(0.05), 115)).toBe(expected);
    expect(currentCdiEffective(empty, 115)).toBeNull();
  });

  it('SHOULD combine the latest expectation with the spread', () => {
    const series: IndexSeriesData = {
      ...empty,
      ipcaExpected: [{ date: '2026-03-10', value: 4.2 }],
    };

    expect(currentIpcaEffective(series, 6)).toBe(((1.042 * 1.06 - 1) * 100).toFixed(6));
    expect(currentIpcaEffective(empty, 6)).toBeNull();
  });
});

describe('hasIndexFor', () => {
  it('SHOULD say whether the series the mode needs exist', () => {
    expect(hasIndexFor(flatCdi(0.05), InvestmentFixedIncomeRateMode.CDI_PERCENT)).toBe(true);
    expect(hasIndexFor(empty, InvestmentFixedIncomeRateMode.CDI_PERCENT)).toBe(false);
    expect(
      hasIndexFor(
        { ...empty, ipcaExpected: [{ date: '2026-03-10', value: 4 }] },
        InvestmentFixedIncomeRateMode.IPCA_PLUS,
      ),
    ).toBe(true);
    expect(hasIndexFor(empty, InvestmentFixedIncomeRateMode.IPCA_PLUS)).toBe(false);
    expect(hasIndexFor(empty, InvestmentFixedIncomeRateMode.PREFIXED)).toBe(true);
  });
});
