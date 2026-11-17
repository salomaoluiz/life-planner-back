import { InvestmentProjectionSource } from './investment-projection.source';

const projections = { execute: jest.fn() };
const materialize = { execute: jest.fn() };
const source = new InvestmentProjectionSource(materialize as never, projections as never);
const owners = [{ owner: 'USER' as never, ownerId: 'user-1' }];

beforeEach(() => jest.resetAllMocks());

describe('InvestmentProjectionSource', () => {
  it('SHOULD ask the investment use case to materialize for these owners (spec 115 FR 18)', async () => {
    await source.materialize({ owners, today: '2026-11-12' });

    expect(materialize.execute).toHaveBeenCalledWith({
      accessibleOwners: owners,
      today: '2026-11-12',
    });
  });

  it('SHOULD serve only the series in finance as account incomes (spec 115 FR 22)', async () => {
    projections.execute.mockResolvedValue([
      {
        accountId: 'acc-1',
        assetId: 'asset-1',
        assetLabel: 'HGLG11',
        categoryId: 'cat-1',
        currency: 'BRL',
        netAmount: 11000,
        number: 24,
        paymentDate: '2026-12-15',
        seriesId: 'series-1',
        withFinance: true,
      },
      { accountId: null, assetId: 'asset-2', categoryId: null, withFinance: false },
    ]);

    const items = await source.findProjections({
      from: '2026-12-01',
      owners,
      to: '2027-01-31',
      today: '2026-11-12',
    });

    expect(projections.execute).toHaveBeenCalledWith({
      accessibleOwners: owners,
      from: '2026-12-01',
      to: '2027-01-31',
      today: '2026-11-12',
    });
    expect(items).toEqual([
      {
        accountId: 'acc-1',
        assetId: 'asset-1',
        categoryId: 'cat-1',
        currency: 'BRL',
        date: '2026-12-15',
        description: 'HGLG11',
        number: 24,
        seriesId: 'series-1',
        value: 11000,
      },
    ]);
  });
});
