import { Prisma } from '@db/client';
import {
  InvestmentAssetClass,
  InvestmentAssetStatus,
  InvestmentOperationType,
} from '@investment/domain/enum';
import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';
import { Decimal8 } from '@shared/infra/decimal';

import { mocks, setup, spies } from './index.mocks';

describe('createAsset', () => {
  it('SHOULD map the params to columns, including the first valuation', async () => {
    spies.createAsset.mockResolvedValue(mocks.asset);

    const asset = await setup.createAsset({
      assetClass: InvestmentAssetClass.BR_STOCK,
      currency: 'BRL',
      initialValuation: { date: '2026-11-09', unitPrice: Decimal8.parse('10.53') },
      name: 'Itausa',
      owner: OwnerType.USER,
      ownerId: 'owner-1',
      ticker: 'ITSA4',
    });

    expect(asset.ticker).toBe('ITSA4');
    expect(spies.createAsset).toHaveBeenCalledWith({
      asset_class: 'BR_STOCK',
      currency: 'BRL',
      name: 'Itausa',
      owner: 'USER',
      owner_id: 'owner-1',
      ticker: 'ITSA4',
      valuation: { date: new Date('2026-11-09T00:00:00.000Z'), unit_price: '10.53000000' },
    });
  });

  it('SHOULD leave the valuation out WHEN there is none', async () => {
    spies.createAsset.mockResolvedValue(mocks.asset);

    await setup.createAsset({
      assetClass: InvestmentAssetClass.PRIVATE,
      currency: 'BRL',
      name: 'Options',
      owner: OwnerType.USER,
      ownerId: 'owner-1',
      ticker: null,
    });

    expect(spies.createAsset.mock.calls[0][0].valuation).toBeUndefined();
  });
});

describe('simple delegations', () => {
  it('SHOULD forward the deletes and the owner checks', async () => {
    spies.deleteAssetsByOwner.mockResolvedValue(3);
    spies.existsByOwner.mockResolvedValue(true);
    const access = { owner: OwnerType.FAMILY, ownerId: 'fam' };

    await setup.deleteAsset('a');
    await setup.deleteOperation('o');
    await setup.deleteValuation('v');
    expect(await setup.deleteAssetsByOwner(access)).toBe(3);
    expect(await setup.existsByOwner(access)).toBe(true);
    expect(spies.deleteAssetsByOwner).toHaveBeenCalledWith('FAMILY', 'fam');
    expect(spies.deleteAsset).toHaveBeenCalledWith('a');
  });
});

describe('findAccountForOperation', () => {
  it('SHOULD map the archived flag AND return undefined for a missing account', async () => {
    spies.findAccountById
      .mockResolvedValueOnce({
        currency: 'USD',
        id: 'acc',
        owner: 'USER',
        owner_id: 'o',
        status: 'ARCHIVED',
      })
      .mockResolvedValueOnce(null);

    expect(await setup.findAccountForOperation('acc')).toEqual({
      archived: true,
      currency: 'USD',
      id: 'acc',
      owner: OwnerType.USER,
      ownerId: 'o',
    });
    expect(await setup.findAccountForOperation('none')).toBeUndefined();
  });
});

describe('findAssetById', () => {
  it('SHOULD load operations and valuations of the asset', async () => {
    spies.findAssetById.mockResolvedValue(mocks.asset);
    spies.findOperationsByAssetIds.mockResolvedValue([mocks.operation]);
    spies.findValuationsByAssetId.mockResolvedValue([mocks.valuation]);

    const asset = await setup.findAssetById('asset-1');

    expect(asset?.operations).toHaveLength(1);
    expect(asset?.valuations[0].unitPrice.toString()).toBe('10.53');
  });

  it('SHOULD return undefined WHEN the asset does not exist', async () => {
    spies.findAssetById.mockResolvedValue(null);

    expect(await setup.findAssetById('x')).toBeUndefined();
    expect(spies.findOperationsByAssetIds).not.toHaveBeenCalled();
  });
});

describe('findAssetsByOwners', () => {
  it('SHOULD attach each asset its own operations and latest valuation', async () => {
    spies.findAssets.mockResolvedValue([mocks.asset, { ...mocks.asset, id: 'asset-2' }]);
    spies.findOperationsByAssetIds.mockResolvedValue([mocks.operation]);
    spies.findLatestValuations.mockResolvedValue([mocks.valuation]);

    const rows = await setup.findAssetsByOwners(
      [{ owner: OwnerType.USER, ownerId: 'owner-1' }],
      InvestmentAssetStatus.ACTIVE,
    );

    expect(rows[0].operations).toHaveLength(1);
    expect(rows[0].latestValuation?.id).toBe('val-1');
    expect(rows[1].operations).toEqual([]);
    expect(rows[1].latestValuation).toBeNull();
    expect(spies.findOperationsByAssetIds).toHaveBeenCalledWith(['asset-1', 'asset-2']);
  });

  it('SHOULD skip the queries WHEN there are no owners or no assets', async () => {
    expect(await setup.findAssetsByOwners([], InvestmentAssetStatus.ACTIVE)).toEqual([]);
    spies.findAssets.mockResolvedValue([]);
    expect(
      await setup.findAssetsByOwners(
        [{ owner: OwnerType.USER, ownerId: 'o' }],
        InvestmentAssetStatus.ARCHIVED,
      ),
    ).toEqual([]);
    expect(spies.findOperationsByAssetIds).not.toHaveBeenCalled();
  });
});

describe('lookups', () => {
  it('SHOULD map ticker, operation, transaction link and valuation lookups', async () => {
    spies.findAssetByTicker.mockResolvedValueOnce(mocks.asset).mockResolvedValueOnce(null);
    spies.findOperationById.mockResolvedValueOnce(mocks.operation).mockResolvedValueOnce(null);
    spies.findOperationByTransactionId
      .mockResolvedValueOnce({ asset_id: 'asset-1', id: 'op-1' })
      .mockResolvedValueOnce(null);
    spies.findValuationById.mockResolvedValueOnce(mocks.valuation).mockResolvedValueOnce(null);

    expect((await setup.findAssetByTicker(OwnerType.USER, 'o', 'ITSA4'))?.id).toBe('asset-1');
    expect(await setup.findAssetByTicker(OwnerType.USER, 'o', 'X')).toBeUndefined();
    expect((await setup.findOperationById('op-1'))?.type).toBe(InvestmentOperationType.BUY);
    expect(await setup.findOperationById('x')).toBeUndefined();
    expect(await setup.findOperationByTransactionId('t')).toEqual({
      assetId: 'asset-1',
      operationId: 'op-1',
    });
    expect(await setup.findOperationByTransactionId('t2')).toBeUndefined();
    expect((await setup.findValuationById('val-1'))?.date).toBe('2026-11-01');
    expect(await setup.findValuationById('x')).toBeUndefined();
  });
});

describe('writes', () => {
  it('SHOULD map an asset update', async () => {
    spies.updateAsset.mockResolvedValue(mocks.asset);

    await setup.updateAsset({
      archivedAt: null,
      id: 'asset-1',
      ownerId: 'o2',
      status: InvestmentAssetStatus.ACTIVE,
    });

    expect(spies.updateAsset).toHaveBeenCalledWith(
      expect.objectContaining({
        archived_at: null,
        id: 'asset-1',
        owner_id: 'o2',
        status: 'ACTIVE',
      }),
    );
  });

  it('SHOULD upsert a valuation with 8 decimals', async () => {
    spies.upsertValuation.mockResolvedValue(mocks.valuation);

    await setup.upsertValuation({
      assetId: 'asset-1',
      date: '2026-11-01',
      unitPrice: Decimal8.parse('10.61'),
    });

    expect(spies.upsertValuation).toHaveBeenCalledWith(
      'asset-1',
      new Date('2026-11-01T00:00:00.000Z'),
      '10.61000000',
    );
  });

  it('SHOULD write an operation with decimals as strings', async () => {
    spies.writeOperation.mockResolvedValue('op-1');

    const id = await setup.writeOperation({
      accountId: 'acc',
      assetId: 'asset-1',
      assetLabel: 'ITSA4',
      currency: 'BRL',
      date: '2026-06-10',
      fees: [],
      feesTotal: 0,
      fxRate: null,
      generateTransaction: true,
      gross: 100,
      quantity: Decimal8.parse('18.3572'),
      total: 100,
      type: InvestmentOperationType.BUY,
      unitPrice: Decimal8.parse('10.2'),
    });

    expect(id).toBe('op-1');
    expect(spies.writeOperation).toHaveBeenCalledWith(
      expect.objectContaining({
        date: new Date('2026-06-10T00:00:00.000Z'),
        quantity: '18.35720000',
        unit_price: '10.20000000',
      }),
    );
  });
});

describe('fixed income', () => {
  const rate = {
    annualRate: '12',
    cdiPercent: null,
    effectiveRate: '12.000000',
    indexRate: null,
    mode: 'PREFIXED' as never,
    spread: null,
    startDate: '2026-01-02',
  };
  const terms = {
    liquidity: 'DAILY' as never,
    liquidityDate: null,
    maturityDate: '2030-01-02',
    product: 'CDB' as never,
    taxExempt: false,
  };

  it('SHOULD group terms, rates and adjustments by asset AND skip assets without terms', async () => {
    spies.findFixedIncomeByAssetIds.mockResolvedValue({
      adjustments: [
        { asset_id: 'a', date: new Date('2026-07-01T00:00:00Z'), gross_amount: 100, id: 'adj' },
      ],
      rates: [
        {
          annual_rate: new Prisma.Decimal('12'),
          asset_id: 'a',
          cdi_percent: null,
          effective_rate: new Prisma.Decimal('12'),
          id: 'r',
          index_rate: null,
          mode: 'PREFIXED',
          spread: null,
          start_date: new Date('2026-01-02T00:00:00Z'),
        },
      ],
      terms: [
        {
          asset_id: 'a',
          liquidity: 'GRACE_PERIOD',
          liquidity_date: new Date('2027-01-02T00:00:00Z'),
          maturity_date: new Date('2030-01-02T00:00:00Z'),
          product: 'CDB',
          tax_exempt: false,
        },
      ],
    });

    const result = await setup.findFixedIncomeByAssetIds(['a', 'b']);

    expect([...result.keys()]).toEqual(['a']);
    expect(result.get('a')?.terms?.liquidityDate).toBe('2027-01-02');
    expect(result.get('a')?.rates[0]).toMatchObject({
      annualRate: '12.0000',
      effectiveRate: '12.000000',
    });
    expect(result.get('a')?.adjustments[0].grossAmount).toBe(100);
    expect(await setup.findFixedIncomeByAssetIds([])).toEqual(new Map());
  });

  it('SHOULD map a rate AND an adjustment by id, undefined WHEN missing', async () => {
    spies.findFixedIncomeRateById.mockResolvedValue(undefined);
    spies.findFixedIncomeAdjustmentById.mockResolvedValue(null);

    expect(await setup.findFixedIncomeRateById('x')).toBeUndefined();
    expect(await setup.findFixedIncomeAdjustmentById('x')).toBeUndefined();
  });

  it('SHOULD delegate the fixed income writes', async () => {
    await setup.createFixedIncomeRate('a', rate);
    await setup.updateFixedIncomeRate('a', 'r', rate);
    await setup.deleteFixedIncomeRate('a', 'r');
    await setup.upsertFixedIncomeAdjustment('a', '2026-07-01', 100);
    await setup.deleteFixedIncomeAdjustment('a', 'adj');
    await setup.saveFixedIncomeTerms({ assetId: 'a', convert: false, terms });

    expect(spies.createFixedIncomeRate).toHaveBeenCalledWith('a', rate);
    expect(spies.updateFixedIncomeRate).toHaveBeenCalledWith('a', 'r', rate);
    expect(spies.deleteFixedIncomeRate).toHaveBeenCalledWith('a', 'r');
    expect(spies.upsertFixedIncomeAdjustment).toHaveBeenCalledWith('a', '2026-07-01', 100);
    expect(spies.deleteFixedIncomeAdjustment).toHaveBeenCalledWith('a', 'adj');
    expect(spies.saveFixedIncomeTerms).toHaveBeenCalled();
  });

  it('SHOULD create a title with the contribution mapped to columns', async () => {
    spies.createFixedIncomeTitle.mockResolvedValue({ assetId: 'a', operationId: 'o' });

    const result = await setup.createFixedIncomeTitle({
      asset: {
        assetClass: InvestmentAssetClass.FIXED_INCOME,
        currency: 'BRL',
        name: 'CDB',
        owner: OwnerType.USER,
        ownerId: 'owner-1',
        ticker: null,
      },
      contribution: {
        accountId: null,
        assetLabel: 'CDB',
        currency: 'BRL',
        date: '2026-01-02',
        fees: [],
        feesTotal: 0,
        fxRate: null,
        generateTransaction: false,
        gross: 100,
        quantity: Decimal8.parse('1'),
        total: 100,
        type: InvestmentOperationType.BUY,
        unitPrice: Decimal8.parse('1'),
      },
      rate,
      terms,
    });

    expect(result).toEqual({ assetId: 'a', operationId: 'o' });
    expect(spies.createFixedIncomeTitle).toHaveBeenCalledWith(
      expect.objectContaining({
        contribution: expect.objectContaining({ quantity: '1.00000000', type: 'BUY' }),
      }),
    );
  });
});
