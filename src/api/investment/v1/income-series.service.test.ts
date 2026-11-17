import { toIncomeSeriesOutput } from './income-series.service';
import { mocks, setup } from './income-series.service.mocks';

const { owners, series, useCases, userId, view } = mocks;

describe('toIncomeSeriesOutput', () => {
  it('SHOULD leave the nulls out AND keep the rule', () => {
    expect(toIncomeSeriesOutput(view)).toEqual({
      accountId: series.accountId,
      amountPerUnit: '1.1',
      assetId: series.assetId,
      categoryId: series.categoryId,
      currency: 'BRL',
      endDate: undefined,
      endedAt: undefined,
      endReason: undefined,
      exDateOffsetDays: 8,
      firstPaymentDate: '2025-01-15',
      frequency: { interval: 1, unit: 'MONTH' },
      id: series.id,
      lastGeneratedNumber: 23,
      nextPaymentDate: '2026-12-15',
      notes: undefined,
      type: 'YIELD',
      withFinance: true,
    });
  });
});

describe('IncomeSeriesService', () => {
  it('SHOULD create with the accessible owners AND answer the counts', async () => {
    useCases.create.execute.mockResolvedValue({ ...view, created: { planned: 1, received: 22 } });

    const result = await setup.create(userId, { amountPerUnit: '1.1' } as never);

    expect(useCases.create.execute).toHaveBeenCalledWith({
      accessibleOwners: owners,
      amountPerUnit: '1.1',
      userId,
    });
    expect(result.created).toEqual({ planned: 1, received: 22 });
    expect(result.item.id).toBe(series.id);
  });

  it('SHOULD materialize before listing the series of an asset', async () => {
    useCases.list.execute.mockResolvedValue([view]);

    const result = await setup.list(userId, series.assetId);

    expect(useCases.materialize.execute).toHaveBeenCalledWith(
      expect.objectContaining({ accessibleOwners: owners }),
    );
    expect(result.items).toHaveLength(1);
  });

  it('SHOULD read by id, preview AND update', async () => {
    useCases.findById.execute.mockResolvedValue(view);
    useCases.preview.execute.mockResolvedValue({ next: [] });
    useCases.update.execute.mockResolvedValue(view);

    expect((await setup.findById(userId, series.id)).item.id).toBe(series.id);
    expect(await setup.preview(userId, { amountPerUnit: '1.1' } as never)).toEqual({ next: [] });
    expect((await setup.update(userId, series.id, { notes: 'x' })).item.id).toBe(series.id);
    expect(useCases.update.execute).toHaveBeenCalledWith({
      accessibleOwners: owners,
      id: series.id,
      notes: 'x',
      userId,
    });
  });

  it('SHOULD answer the projections, narrowed to the owner AND without nulls', async () => {
    useCases.projections.execute.mockResolvedValue([
      { accountId: null, categoryId: null, netAmount: 1 },
      { accountId: 'a', categoryId: 'c', netAmount: 2 },
    ]);

    const result = await setup.projections(userId, {
      from: '2026-12-01',
      ownerId: 'family-1',
      to: '2027-01-31',
    });

    expect(useCases.projections.execute).toHaveBeenCalledWith({
      accessibleOwners: owners,
      from: '2026-12-01',
      ownerIds: ['family-1'],
      to: '2027-01-31',
    });
    expect(result.items).toEqual([
      { accountId: undefined, categoryId: undefined, netAmount: 1 },
      { accountId: 'a', categoryId: 'c', netAmount: 2 },
    ]);
  });
});
