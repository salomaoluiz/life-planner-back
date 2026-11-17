import { InvestmentAssetClass, InvestmentIncomeType } from '@investment/domain/enum';
import { planOccurrences } from '@investment/domain/service/IncomeSeriesPositions';
import { Decimal8 } from '@shared/infra/decimal';

const occurrences = [
  { exDate: '2026-01-07', number: 1, paymentDate: '2026-01-15' },
  { exDate: '2026-02-07', number: 2, paymentDate: '2026-02-15' },
  { exDate: '2026-03-07', number: 3, paymentDate: '2026-03-15' },
];
const base = {
  amountPerUnit: '1.10',
  assetClass: InvestmentAssetClass.BR_REIT,
  occurrences,
  type: InvestmentIncomeType.YIELD,
};

describe('planOccurrences', () => {
  it('multiplies the position at each ex-date by the amount per unit', () => {
    const plan = planOccurrences({
      ...base,
      positionAt: (date) => Decimal8.parse(date < '2026-02-01' ? '100' : '120'),
    });

    expect(plan.endsAt).toBeNull();
    expect(plan.items.map((item) => item.netAmount)).toEqual([11000, 13200, 13200]);
    expect(plan.items.map((item) => item.quantity)).toEqual(['100', '120', '120']);
  });

  it('ends the series at the first occurrence with no position', () => {
    const plan = planOccurrences({
      ...base,
      positionAt: (date) => Decimal8.parse(date < '2026-02-01' ? '100' : '0'),
    });

    expect(plan.items).toHaveLength(1);
    expect(plan.endsAt).toBe('2026-02-15');
  });

  it('has no items when the first occurrence has no position', () => {
    const plan = planOccurrences({ ...base, positionAt: () => Decimal8.zero() });

    expect(plan).toEqual({ endsAt: '2026-01-15', items: [] });
  });

  it('applies the JCP withholding', () => {
    const plan = planOccurrences({
      ...base,
      occurrences: occurrences.slice(0, 1),
      positionAt: () => Decimal8.parse('100'),
      type: InvestmentIncomeType.JCP,
    });

    expect(plan.items[0].netAmount).toBe(9350);
  });
});
