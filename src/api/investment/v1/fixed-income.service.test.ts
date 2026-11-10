import { toAssetDetailView } from '@investment/application/service/AssetView';
import { emptyContext } from '@investment/application/service/QuoteContext';
import {
  assetFixture,
  fixedIncomeDataFixture,
  fixedIncomeDetailFixture,
  operationFixture,
} from '@investment/domain/entity/mocks/investment.fixture';

import { mocks, setup } from './fixed-income.service.mocks';
import { toAssetDetail } from './investment.service';

const assetId = '0b6a1e7c-3f4d-4b2a-8c9d-1e2f3a4b5c6d';
const detail = toAssetDetailView(fixedIncomeDetailFixture(), {
  ...emptyContext(new Date('2026-11-10T15:00:00Z')),
  fixedIncome: new Map([['asset-fi', fixedIncomeDataFixture()]]),
});

describe('detail mapping', () => {
  it('SHOULD map the fixed income summary, lots, rates AND projection of a calculated title', () => {
    const { fixedIncome } = toAssetDetail(detail).item;

    expect(fixedIncome?.product).toBe('CDB');
    expect(fixedIncome?.lots).toHaveLength(1);
    expect(fixedIncome?.rates[0]).toMatchObject({ effectiveRate: '12.000000', mode: 'PREFIXED' });
    expect(fixedIncome?.atMaturity.gross).toBeGreaterThan(fixedIncome?.today.gross ?? 0);
  });

  it('SHOULD map a manual asset with no fixed income', () => {
    const manual = toAssetDetailView({ ...assetFixture(), operations: [], valuations: [] });

    expect(toAssetDetail(manual).item.fixedIncome).toBeNull();
  });
});

describe('writes', () => {
  beforeEach(() => {
    mocks.useCases.createTitle.execute.mockResolvedValue(detail);
    mocks.useCases.createRate.execute.mockResolvedValue(detail);
    mocks.useCases.updateRate.execute.mockResolvedValue(detail);
    mocks.useCases.upsertTerms.execute.mockResolvedValue(detail);
  });

  it('SHOULD create a title, resolving the owners', async () => {
    const input = {
      contribution: { amount: 1_000_000, date: '2026-01-02' },
      name: 'CDB',
      owner: 'USER' as never,
      ownerId: mocks.userId,
      rate: { annualRate: '12', mode: 'PREFIXED' as never },
      terms: {
        liquidity: 'DAILY' as never,
        maturityDate: '2030-01-02',
        product: 'CDB' as never,
        taxExempt: false,
      },
    };

    const result = await setup.createTitle(mocks.userId, input);

    expect(mocks.useCases.createTitle.execute).toHaveBeenCalledWith({
      ...input,
      accessibleOwners: mocks.accessibleOwners,
    });
    expect(result.item.fixedIncome?.product).toBe('CDB');
  });

  it('SHOULD split the rate from the terms on PUT terms', async () => {
    const rate = { annualRate: '12', mode: 'PREFIXED' as never, startDate: '2026-01-02' };

    await setup.upsertTerms(mocks.userId, assetId, {
      liquidity: 'DAILY' as never,
      maturityDate: '2030-01-02',
      product: 'CDB' as never,
      rate,
      taxExempt: false,
    });

    expect(mocks.useCases.upsertTerms.execute).toHaveBeenCalledWith({
      accessibleOwners: mocks.accessibleOwners,
      assetId,
      rate,
      terms: {
        liquidity: 'DAILY',
        maturityDate: '2030-01-02',
        product: 'CDB',
        taxExempt: false,
      },
    });
  });

  it('SHOULD create, update AND delete rates by id', async () => {
    const rate = { annualRate: '12', mode: 'PREFIXED' as never, startDate: '2026-01-02' };

    await setup.createRate(mocks.userId, assetId, rate);
    await setup.updateRate(mocks.userId, 'rate-1', rate);
    await setup.deleteRate(mocks.userId, 'rate-1');

    expect(mocks.useCases.createRate.execute).toHaveBeenCalledWith({
      accessibleOwners: mocks.accessibleOwners,
      assetId,
      rate,
    });
    expect(mocks.useCases.updateRate.execute).toHaveBeenCalledWith({
      accessibleOwners: mocks.accessibleOwners,
      id: 'rate-1',
      rate,
    });
    expect(mocks.useCases.deleteRate.execute).toHaveBeenCalledWith({
      accessibleOwners: mocks.accessibleOwners,
      id: 'rate-1',
    });
  });

  it('SHOULD answer a contribution AND a redemption with the item, the detail and the warning', async () => {
    const written = {
      detail,
      liquidityWarning: 'AT_MATURITY',
      operation: { costRemoved: null, operation: operationFixture(), realizedResult: null },
    };

    mocks.useCases.createContribution.execute.mockResolvedValue(written);
    mocks.useCases.createRedemption.execute.mockResolvedValue(written);

    const contribution = await setup.createContribution(mocks.userId, assetId, {
      amount: 500_000,
      date: '2026-10-20',
    });
    const redemption = await setup.createRedemption(mocks.userId, assetId, {
      date: '2026-11-04',
      kind: 'PARTIAL' as never,
      netAmount: 600_000,
    });

    expect(contribution.liquidityWarning).toBe('AT_MATURITY');
    expect(contribution.detail.fixedIncome?.product).toBe('CDB');
    expect(redemption.item.id).toBe(written.operation.operation.id);
    expect(mocks.useCases.createContribution.execute).toHaveBeenCalledWith({
      accessibleOwners: mocks.accessibleOwners,
      amount: 500_000,
      assetId,
      date: '2026-10-20',
    });
  });

  it('SHOULD answer an adjustment with the computed gross AND delete it by id', async () => {
    mocks.useCases.upsertAdjustment.execute.mockResolvedValue({
      computedGross: 1_090_000,
      detail,
      item: { date: '2026-07-01', grossAmount: 1_100_000, id: 'adj-1' },
    });

    const result = await setup.upsertAdjustment(mocks.userId, assetId, '2026-07-01', {
      grossAmount: 1_100_000,
    });
    await setup.deleteAdjustment(mocks.userId, 'adj-1');

    expect(result.item).toEqual({
      computedGross: 1_090_000,
      date: '2026-07-01',
      grossAmount: 1_100_000,
      id: 'adj-1',
    });
    expect(mocks.useCases.deleteAdjustment.execute).toHaveBeenCalledWith({
      accessibleOwners: mocks.accessibleOwners,
      id: 'adj-1',
    });
  });
});

describe('simulations', () => {
  it('SHOULD simulate without the owners AND preview with them', async () => {
    mocks.useCases.simulate.execute.mockResolvedValue({ effectiveRate: '12.000000' });
    mocks.useCases.previewRedemption.execute.mockResolvedValue({ net: 1 });

    const input = {
      amount: 1_000_000,
      date: '2026-01-02',
      maturityDate: '2028-01-03',
      rate: { annualRate: '12', mode: 'PREFIXED' as never },
      taxExempt: false,
    };

    expect(await setup.simulate(input)).toEqual({ effectiveRate: '12.000000' });
    expect(mocks.useCases.simulate.execute).toHaveBeenCalledWith(input);

    await setup.previewRedemption(mocks.userId, assetId, {
      date: '2026-11-04',
      kind: 'PARTIAL' as never,
      netAmount: 600_000,
    });

    expect(mocks.useCases.previewRedemption.execute).toHaveBeenCalledWith({
      accessibleOwners: mocks.accessibleOwners,
      assetId,
      date: '2026-11-04',
      kind: 'PARTIAL',
      netAmount: 600_000,
    });
  });
});
