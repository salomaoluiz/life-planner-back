import { InvestmentFixedIncomeRateMode } from '@investment/domain/enum';
import { effectiveRateOf } from '@investment/domain/service/FixedIncomeRate';
import { IndexSeriesData } from '@investment/domain/service/IndexSeries';

const SERIES: IndexSeriesData = {
  cdiDaily: [{ date: '2026-03-02', value: 0.05 }],
  ipcaExpected: [{ date: '2026-03-02', value: 4.5 }],
  ipcaMonthly: [],
};

describe('FixedIncomeRate', () => {
  it('derives 110% of the latest daily CDI from the stored series', () => {
    const rate = effectiveRateOf(
      { cdiPercent: '110', mode: InvestmentFixedIncomeRateMode.CDI_PERCENT },
      SERIES,
    );

    expect(rate).toBe(((Math.pow(1 + (0.05 * 1.1) / 100, 252) - 1) * 100).toFixed(6));
  });

  it('derives IPCA expectation 4.50 + 6.20 as 10.979 (compounded)', () => {
    const rate = effectiveRateOf(
      { mode: InvestmentFixedIncomeRateMode.IPCA_PLUS, spread: '6.20' },
      SERIES,
    );

    expect(rate).toBe('10.979000');
  });

  it('returns 0 for an indexed mode WHEN there is no stored series', () => {
    expect(
      effectiveRateOf({ cdiPercent: '110', mode: InvestmentFixedIncomeRateMode.CDI_PERCENT }),
    ).toBe('0.000000');
    expect(effectiveRateOf({ mode: InvestmentFixedIncomeRateMode.IPCA_PLUS, spread: '6' })).toBe(
      '0.000000',
    );
  });

  it('returns the prefixed rate with 6 places', () => {
    expect(
      effectiveRateOf({ annualRate: '13.5', mode: InvestmentFixedIncomeRateMode.PREFIXED }),
    ).toBe('13.500000');
  });
});
