import { Prisma } from '@db/client';
import { FixedIncomeRedemptionTooLargeError } from '@investment/domain/error/FixedIncomeRedemptionTooLargeError';

import {
  convertManualOperations,
  deleteAdjustment,
  deleteRate,
  insertRate,
  recalculateFixedIncome,
  replaceRate,
  saveAdjustment,
  saveTerms,
} from './index';

function date(value: string) {
  return new Date(`${value}T00:00:00Z`);
}
function decimal(value: string) {
  return new Prisma.Decimal(value);
}

const spies = {
  adjustmentDeleteMany: jest.fn(),
  adjustmentFindMany: jest.fn(),
  adjustmentUpsert: jest.fn(),
  operationFindMany: jest.fn(),
  operationUpdate: jest.fn(),
  rateCreate: jest.fn(),
  rateDeleteMany: jest.fn(),
  rateFindMany: jest.fn(),
  rateUpdate: jest.fn(),
  termsFindUnique: jest.fn(),
  termsUpsert: jest.fn(),
  valuationDeleteMany: jest.fn(),
};
const tx = {
  investmentFixedIncomeAdjustment: {
    deleteMany: spies.adjustmentDeleteMany,
    findMany: spies.adjustmentFindMany,
    upsert: spies.adjustmentUpsert,
  },
  investmentFixedIncomeRate: {
    create: spies.rateCreate,
    deleteMany: spies.rateDeleteMany,
    findMany: spies.rateFindMany,
    update: spies.rateUpdate,
  },
  investmentFixedIncomeTerms: { findUnique: spies.termsFindUnique, upsert: spies.termsUpsert },
  investmentOperation: { findMany: spies.operationFindMany, update: spies.operationUpdate },
  investmentValuation: { deleteMany: spies.valuationDeleteMany },
} as unknown as Prisma.TransactionClient;

const rate = {
  annualRate: '12',
  cdiPercent: null,
  effectiveRate: '12.000000',
  indexRate: null,
  mode: 'PREFIXED' as never,
  spread: null,
  startDate: '2026-01-02',
};

beforeEach(() => {
  jest.resetAllMocks();
});

describe('recalculateFixedIncome', () => {
  function seed(sellNet: number) {
    spies.termsFindUnique.mockResolvedValue({
      maturity_date: date('2030-01-02'),
      tax_exempt: false,
    });
    spies.rateFindMany.mockResolvedValue([
      { effective_rate: decimal('12'), start_date: date('2026-01-02') },
    ]);
    spies.adjustmentFindMany.mockResolvedValue([]);
    spies.operationFindMany.mockResolvedValue([
      {
        date: date('2026-01-02'),
        id: 'buy-1',
        net_amount: null,
        quantity: decimal('10000'),
        redemption_kind: null,
        type: 'BUY',
      },
      {
        date: date('2026-11-04'),
        id: 'sell-1',
        net_amount: sellNet,
        quantity: decimal('0'),
        redemption_kind: 'PARTIAL',
        type: 'SELL',
      },
    ]);
  }

  it('SHOULD do nothing for an asset without terms', async () => {
    spies.termsFindUnique.mockResolvedValue(null);

    await recalculateFixedIncome(tx, 'asset-1');

    expect(spies.operationFindMany).not.toHaveBeenCalled();
    expect(spies.operationUpdate).not.toHaveBeenCalled();
  });

  it('SHOULD rewrite the derived columns of every redemption with the IR fee', async () => {
    seed(600_000);

    await recalculateFixedIncome(tx, 'asset-1');

    const { data, where } = spies.operationUpdate.mock.calls[0][0];

    expect(where).toEqual({ id: 'sell-1' });
    expect(data.total).toBe(600_000);
    expect(data.gross).toBe(data.total + data.fees_total);
    expect(data.fees.create.map((fee: { kind: string }) => fee.kind)).toContain('INCOME_TAX');
    expect(data.quantity).toMatch(/^\d+\.\d{2}$/);
    expect(data.unit_price).toMatch(/^\d+\.\d{8}$/);
  });

  it('SHOULD throw WHEN a redemption no longer fits the title', async () => {
    seed(90_000_000);

    await expect(recalculateFixedIncome(tx, 'asset-1')).rejects.toEqual(
      new FixedIncomeRedemptionTooLargeError('2026-11-04', 'sell-1'),
    );
    expect(spies.operationUpdate).not.toHaveBeenCalled();
  });
});

describe('writes', () => {
  it('SHOULD insert, replace and delete rates', async () => {
    await insertRate(tx, 'asset-1', rate);
    await replaceRate(tx, 'rate-1', rate);
    await deleteRate(tx, 'rate-1');

    expect(spies.rateCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ annual_rate: '12', asset_id: 'asset-1', mode: 'PREFIXED' }),
    });
    expect(spies.rateUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'rate-1' } }),
    );
    expect(spies.rateDeleteMany).toHaveBeenCalledWith({ where: { id: 'rate-1' } });
  });

  it('SHOULD upsert an adjustment by asset and date AND delete it', async () => {
    await saveAdjustment(tx, 'asset-1', '2026-07-01', 1_100_000);
    await deleteAdjustment(tx, 'adj-1');

    expect(spies.adjustmentUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: { gross_amount: 1_100_000 },
        where: { asset_id_date: { asset_id: 'asset-1', date: date('2026-07-01') } },
      }),
    );
    expect(spies.adjustmentDeleteMany).toHaveBeenCalledWith({ where: { id: 'adj-1' } });
  });

  it('SHOULD upsert the terms with the dates as calendar days', async () => {
    await saveTerms(tx, 'asset-1', {
      liquidity: 'GRACE_PERIOD' as never,
      liquidityDate: '2027-01-02',
      maturityDate: '2028-01-02',
      product: 'CDB' as never,
      taxExempt: false,
    });

    expect(spies.termsUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({
          liquidity_date: date('2027-01-02'),
          maturity_date: date('2028-01-02'),
        }),
        where: { asset_id: 'asset-1' },
      }),
    );
  });

  it('SHOULD turn manual sells into partial redemptions AND drop the valuations', async () => {
    spies.operationFindMany.mockResolvedValue([{ id: 'sell-1', total: 500_000 }]);

    await convertManualOperations(tx, 'asset-1');

    expect(spies.operationUpdate).toHaveBeenCalledWith({
      data: { net_amount: 500_000, redemption_kind: 'PARTIAL' },
      where: { id: 'sell-1' },
    });
    expect(spies.valuationDeleteMany).toHaveBeenCalledWith({ where: { asset_id: 'asset-1' } });
  });
});
