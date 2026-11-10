import { InvestmentFixedIncomeRateMode } from '@investment/domain/enum';
import { effectiveRateOf } from '@investment/domain/service/FixedIncomeRate';

describe('FixedIncomeRate', () => {
  it('derives 110% of a 14.90 CDI as about 16.51', () => {
    const rate = effectiveRateOf({
      cdiPercent: '110',
      indexRate: '14.90',
      mode: InvestmentFixedIncomeRateMode.CDI_PERCENT,
    });

    expect(Number(rate)).toBeCloseTo(16.51, 1);
    expect(rate).toMatch(/^\d+\.\d{6}$/);
  });

  it('derives IPCA 4.50 + 6.20 as 10.979 (compounded)', () => {
    const rate = effectiveRateOf({
      indexRate: '4.50',
      mode: InvestmentFixedIncomeRateMode.IPCA_PLUS,
      spread: '6.20',
    });

    expect(rate).toBe('10.979000');
  });

  it('returns the prefixed rate with 6 places', () => {
    expect(
      effectiveRateOf({ annualRate: '13.5', mode: InvestmentFixedIncomeRateMode.PREFIXED }),
    ).toBe('13.500000');
  });
});
