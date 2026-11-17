import { FixedIncomeData } from '@investment/domain/entity/FixedIncomeEntity';
import { operationFixture } from '@investment/domain/entity/mocks/investment.fixture';
import {
  InvestmentFixedIncomeLiquidity,
  InvestmentFixedIncomeProduct,
  InvestmentFixedIncomeRateMode,
  InvestmentFixedIncomeRedemptionKind,
  InvestmentOperationType,
} from '@investment/domain/enum';
import { Decimal8 } from '@shared/infra/decimal';

import { toFixedIncomeView } from './index';

const data: FixedIncomeData = {
  adjustments: [],
  rates: [
    {
      annualRate: '12.0000',
      assetId: 'a',
      cdiPercent: null,
      effectiveRate: '12.000000',
      id: 'r1',
      mode: InvestmentFixedIncomeRateMode.PREFIXED,
      spread: null,
      startDate: '2026-01-02',
    },
  ],
  terms: {
    assetId: 'a',
    liquidity: InvestmentFixedIncomeLiquidity.AT_MATURITY,
    liquidityDate: null,
    maturityDate: '2027-01-04',
    product: InvestmentFixedIncomeProduct.CDB,
    taxExempt: false,
  },
};
const lot = operationFixture({
  date: '2026-01-02',
  id: 'lot-1',
  quantity: Decimal8.parse('10000'),
  total: 1_000_000,
  unitPrice: Decimal8.parse('1'),
});

describe('toFixedIncomeView', () => {
  it('SHOULD be null for an asset without terms', () => {
    expect(toFixedIncomeView(undefined, [lot], '2026-11-10')).toBeNull();
    expect(toFixedIncomeView({ ...data, terms: null }, [lot], '2026-11-10')).toBeNull();
  });

  it('SHOULD compute today, the projection at maturity AND the open lots', () => {
    const view = toFixedIncomeView(data, [lot], '2026-11-10');

    expect(view?.lots).toHaveLength(1);
    expect(view?.lots[0].principal).toBe(1_000_000);
    expect(view?.today.gross).toBeGreaterThan(1_000_000);
    expect(view?.atMaturity.gross).toBeGreaterThan(view?.today.gross ?? 0);
    expect(view?.currentEffectiveRate).toBe('12.000000');
    expect(view?.maturityPending).toBe(false);
  });

  it('SHOULD be pending maturity once the maturity passed with principal left', () => {
    const view = toFixedIncomeView(data, [lot], '2027-02-01');

    expect(view?.maturityPending).toBe(true);
    expect(view?.today.gross).toBe(view?.atMaturity.gross);
  });

  it('SHOULD stop being pending after a total redemption', () => {
    const sell = operationFixture({
      date: '2027-01-04',
      id: 'sell-1',
      netAmount: 1_100_000,
      quantity: Decimal8.parse('0'),
      redemptionKind: InvestmentFixedIncomeRedemptionKind.TOTAL,
      total: 1_100_000,
      type: InvestmentOperationType.SELL,
    });
    const view = toFixedIncomeView(data, [sell, lot], '2027-02-01');

    expect(view?.maturityPending).toBe(false);
    expect(view?.lots).toHaveLength(0);
  });

  describe('indexed rates (spec 113)', () => {
    const cdiData: FixedIncomeData = {
      ...data,
      rates: [
        {
          annualRate: null,
          assetId: 'a',
          cdiPercent: '110.0000',
          effectiveRate: '0.000000',
          id: 'r1',
          mode: InvestmentFixedIncomeRateMode.CDI_PERCENT,
          spread: null,
          startDate: '2026-01-02',
        },
      ],
    };
    const series = {
      cdiDaily: [{ date: '2026-01-02', value: 0.05 }],
      ipcaExpected: [],
      ipcaMonthly: [],
    };

    it('SHOULD flag indexMissing AND keep the snapshot rate WHEN no CDI is stored', () => {
      const view = toFixedIncomeView(cdiData, [lot], '2026-11-10');

      expect(view?.indexMissing).toBe(true);
      expect(view?.currentEffectiveRate).toBe('0.000000');
    });

    it('SHOULD follow the stored CDI AND show its annual rate WHEN the series exists', () => {
      const view = toFixedIncomeView(cdiData, [lot], '2026-11-10', series);

      expect(view?.indexMissing).toBe(false);
      expect(view?.currentEffectiveRate).toBe(
        ((Math.pow(1 + (0.05 * 1.1) / 100, 252) - 1) * 100).toFixed(6),
      );
      expect(view?.today.gross).toBeGreaterThan(1_080_000);
    });

    it('SHOULD flag needsReview WHEN a redemption no longer fits the curve, AND keep the numbers', () => {
      const sell = operationFixture({
        date: '2026-06-01',
        id: 'sell-1',
        netAmount: 1_100_000,
        quantity: Decimal8.parse('0'),
        redemptionKind: InvestmentFixedIncomeRedemptionKind.PARTIAL,
        total: 1_100_000,
        type: InvestmentOperationType.SELL,
      });
      const view = toFixedIncomeView(cdiData, [sell, lot], '2026-11-10', {
        ...series,
        cdiDaily: [{ date: '2026-01-02', value: 0.0001 }],
      });

      expect(view?.needsReview).toEqual({ date: '2026-06-01', operationId: 'sell-1' });
      expect(view?.today.gross).toBeGreaterThan(0);
    });

    it('SHOULD have no needsReview for a title whose redemptions fit', () => {
      expect(toFixedIncomeView(data, [lot], '2026-11-10')?.needsReview).toBeNull();
    });
  });
});
