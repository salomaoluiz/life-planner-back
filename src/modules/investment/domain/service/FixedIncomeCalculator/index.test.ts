import { InvestmentFixedIncomeRedemptionKind } from '@investment/domain/enum';
import { businessDays } from '@investment/domain/service/BusinessDayCalendar';
import {
  CalcInput,
  calculateTitle,
  projectAtMaturity,
} from '@investment/domain/service/FixedIncomeCalculator';

const TERMS = { maturityDate: '2030-01-02', taxExempt: false };
const RATE_12 = { effectiveRate: 12, startDate: '2026-01-02' };

function dateAfterBusinessDays(from: string, count: number): string {
  let day = from;

  while (businessDays(from, day) < count) {
    day = new Date(new Date(`${day}T00:00:00Z`).getTime() + 86_400_000).toISOString().slice(0, 10);
  }

  return day;
}
function input(overrides: Partial<CalcInput>): CalcInput {
  return {
    adjustments: [],
    lots: [{ date: '2026-01-02', operationId: 'lot-1', principal: 1_000_000 }],
    on: '2027-01-04',
    rates: [RATE_12],
    redemptions: [],
    terms: TERMS,
    ...overrides,
  };
}

describe('FixedIncomeCalculator', () => {
  it('grows 12% a.a. prefixed to 11200.00 after exactly 252 business days', () => {
    const on = dateAfterBusinessDays('2026-01-02', 252);
    const result = calculateTitle(input({ on }));

    expect(result.lots[0].gross).toBe(1_120_000);
    expect(result.totals.gross).toBe(1_120_000);
  });

  it('applies IOF on a 15 day old lot and IR on yield minus IOF; LCI has no IR', () => {
    const taxed = calculateTitle(input({ on: '2026-01-17' })).lots[0];
    const exempt = calculateTitle(input({ on: '2026-01-17', terms: { ...TERMS, taxExempt: true } }))
      .lots[0];

    expect(taxed.iofRate).toBe('0.5');
    expect(taxed.iof).toBe(Math.round((taxed.gross - 1_000_000) * 0.5));
    expect(taxed.ir).toBe(Math.round((taxed.gross - 1_000_000 - taxed.iof) * 0.225));
    expect(exempt.ir).toBe(0);
    expect(exempt.iof).toBe(taxed.iof);
  });

  it('keeps the gross before a rate change and grows with the new rate after it', () => {
    const changeDate = '2026-07-01';
    const before = calculateTitle(input({ on: changeDate })).lots[0].gross;
    const withChange = input({
      on: '2027-01-04',
      rates: [RATE_12, { effectiveRate: 6, startDate: changeDate }],
    });
    const at = calculateTitle({ ...withChange, on: changeDate }).lots[0].gross;
    const after = calculateTitle(withChange).lots[0].gross;
    const plain = calculateTitle(input({ on: '2027-01-04' })).lots[0].gross;

    expect(at).toBe(before);
    expect(after).toBeGreaterThan(before);
    expect(after).toBeLessThan(plain);
  });

  it('stops growing at maturity', () => {
    const terms = { ...TERMS, maturityDate: '2026-07-01' };
    const atMaturity = calculateTitle(input({ on: '2026-07-01', terms })).lots[0].gross;
    const later = calculateTitle(input({ on: '2026-12-01', terms })).lots[0].gross;

    expect(later).toBe(atMaturity);
  });

  it('projects at maturity with the same engine', () => {
    const projection = projectAtMaturity(input({ on: '2026-03-02' }));

    expect(projection.totals.gross).toBe(
      calculateTitle(input({ on: TERMS.maturityDate })).totals.gross,
    );
  });

  describe('redemptions', () => {
    const twoLots = {
      lots: [
        { date: '2026-01-02', operationId: 'lot-1', principal: 1_000_000 },
        { date: '2026-03-02', operationId: 'lot-2', principal: 500_000 },
      ],
    };

    it('consumes only the first lot for a partial below its net, oldest first', () => {
      const result = calculateTitle(
        input({
          ...twoLots,
          on: '2027-01-04',
          redemptions: [
            {
              date: '2026-11-04',
              kind: InvestmentFixedIncomeRedemptionKind.PARTIAL,
              netAmount: 600_000,
              operationId: 'sell-1',
            },
          ],
        }),
      );
      const redemption = result.redemptions.get('sell-1');

      expect(result.error).toBeUndefined();
      expect(redemption?.lotsUsed.map((lot) => lot.operationId)).toEqual(['lot-1']);
      expect(redemption?.gross).toBe((redemption?.iof ?? 0) + (redemption?.ir ?? 0) + 600_000);
      expect(redemption?.principalUsed).toBeLessThan(600_000);
      expect(result.lots.map((lot) => lot.operationId)).toEqual(['lot-1', 'lot-2']);
      expect(result.lots[1].remainingPrincipal).toBe(500_000);
    });

    it('reports availableNet when a partial is larger than the title', () => {
      const result = calculateTitle(
        input({
          ...twoLots,
          redemptions: [
            {
              date: '2026-11-04',
              kind: InvestmentFixedIncomeRedemptionKind.PARTIAL,
              netAmount: 9_000_000,
              operationId: 'sell-1',
            },
          ],
        }),
      );

      expect(result.error?.operationId).toBe('sell-1');
      expect(result.error?.date).toBe('2026-11-04');
      expect(result.error?.availableNet).toBeGreaterThan(1_400_000);
    });

    it('splits the real withheld tax by the estimates on a total below the estimate', () => {
      const result = calculateTitle(
        input({
          on: '2027-01-04',
          redemptions: [
            {
              date: '2026-11-04',
              kind: InvestmentFixedIncomeRedemptionKind.TOTAL,
              netAmount: 1_050_000,
              operationId: 'sell-1',
            },
          ],
        }),
      );
      const redemption = result.redemptions.get('sell-1');

      expect(redemption?.principalUsed).toBe(1_000_000);
      expect((redemption?.gross ?? 0) - (redemption?.iof ?? 0) - (redemption?.ir ?? 0)).toBe(
        1_050_000,
      );
      expect(result.remainingPrincipal).toBe(0);
    });

    it('uses the net as the gross when the curve gross is lower (total)', () => {
      const result = calculateTitle(
        input({
          redemptions: [
            {
              date: '2026-01-02',
              kind: InvestmentFixedIncomeRedemptionKind.TOTAL,
              netAmount: 1_000_100,
              operationId: 'sell-1',
            },
          ],
        }),
      );

      expect(result.redemptions.get('sell-1')?.gross).toBe(1_000_100);
    });

    it('redeems on the same day without negative taxes', () => {
      const result = calculateTitle(
        input({
          redemptions: [
            {
              date: '2026-01-02',
              kind: InvestmentFixedIncomeRedemptionKind.TOTAL,
              netAmount: 1_000_000,
              operationId: 'sell-1',
            },
          ],
        }),
      );
      const redemption = result.redemptions.get('sell-1');

      expect(redemption?.iof).toBe(0);
      expect(redemption?.ir).toBe(0);
    });

    it('refuses a redemption on a title with nothing open', () => {
      const result = calculateTitle(
        input({
          redemptions: [
            {
              date: '2026-06-01',
              kind: InvestmentFixedIncomeRedemptionKind.TOTAL,
              netAmount: 1_050_000,
              operationId: 'sell-1',
            },
            {
              date: '2026-07-01',
              kind: InvestmentFixedIncomeRedemptionKind.TOTAL,
              netAmount: 10_000,
              operationId: 'sell-2',
            },
          ],
        }),
      );

      expect(result.error?.operationId).toBe('sell-2');
      expect(result.error?.availableNet).toBe(0);
    });
  });

  describe('adjustments', () => {
    it('makes the gross equal the statement on that date and accrues from it', () => {
      const adjustments = [{ date: '2026-07-01', grossAmount: 1_100_000 }];
      const at = calculateTitle(input({ adjustments, on: '2026-07-01' }));
      const next = calculateTitle(input({ adjustments, on: '2026-07-02' }));

      expect(at.totals.gross).toBe(1_100_000);
      expect(next.totals.gross).toBeGreaterThanOrEqual(1_100_000);
      expect(next.totals.gross).toBeLessThan(1_101_000);
    });

    it('keeps each lot with its share and the exact total (rounding to the largest lot)', () => {
      const adjustments = [{ date: '2026-07-01', grossAmount: 1_700_001 }];
      const result = calculateTitle(
        input({
          adjustments,
          lots: [
            { date: '2026-01-02', operationId: 'lot-1', principal: 1_000_000 },
            { date: '2026-03-02', operationId: 'lot-2', principal: 500_000 },
            { date: '2026-04-01', operationId: 'lot-3', principal: 100_000 },
          ],
          on: '2026-07-01',
        }),
      );

      expect(result.totals.gross).toBe(1_700_001);
      expect(result.lots).toHaveLength(3);
    });
  });
});
