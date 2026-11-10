import { NotFoundException } from '@nestjs/common';

import { Decimal8 } from '@shared/infra/decimal';

import { mocks, setup, spies } from './index.mocks';

beforeEach(() => {
  jest.useFakeTimers().setSystemTime(new Date('2026-11-06T12:00:00Z'));
});

afterEach(() => jest.useRealTimers());

describe('GetPriceHistoryUseCase', () => {
  it('SHOULD return closes after the synthetic points WITH the rate of each date (carried forward)', async () => {
    spies.investments.findAssetById.mockResolvedValue(mocks.usDetail);
    spies.quotes.findHistory.mockResolvedValue([
      { close: Decimal8.parse('228.57'), date: '2026-11-04' },
      { close: Decimal8.parse('231.4'), date: '2026-11-05' },
    ]);
    spies.quotes.findFxOnOrBefore.mockResolvedValue('5.2236');
    spies.quotes.findFxHistory.mockResolvedValue([{ date: '2026-11-04', rate: '5.5412' }]);
    spies.quotes.findFx.mockResolvedValue({ rate: '5.5601' });

    const result = await setup.execute({ accessibleOwners: mocks.owners, id: 'a', range: 'ALL' });

    expect(result.currency).toBe('USD');
    expect(result.historyStartsAt).toBe('2026-11-04');
    expect(result.points.map((point) => [point.date, point.kind, point.fxRate])).toEqual([
      ['2025-11-04', 'OPERATION', '5.2236'],
      ['2025-12-01', 'VALUATION', '5.2236'],
      ['2026-11-04', 'CLOSE', '5.5412'],
      ['2026-11-05', 'CLOSE', '5.5412'],
    ]);
  });

  it('SHOULD fall back to the latest rate WHEN no history reaches the date', async () => {
    spies.investments.findAssetById.mockResolvedValue(mocks.usDetail);
    spies.quotes.findHistory.mockResolvedValue([]);
    spies.quotes.findFxOnOrBefore.mockResolvedValue(undefined);
    spies.quotes.findFxHistory.mockResolvedValue([]);
    spies.quotes.findFx.mockResolvedValue({ rate: '5.5601' });

    const result = await setup.execute({ accessibleOwners: mocks.owners, id: 'a', range: 'ALL' });

    expect(result.points.every((point) => point.fxRate === '5.5601')).toBe(true);
  });

  it('SHOULD return only synthetic points and no rate for a BRL asset WITHOUT a quoted class', async () => {
    spies.investments.findAssetById.mockResolvedValue({
      ...mocks.usDetail,
      assetClass: 'PRIVATE',
      currency: 'BRL',
      ticker: null,
    });

    const result = await setup.execute({ accessibleOwners: mocks.owners, id: 'a', range: 'ALL' });

    expect(spies.quotes.findHistory).not.toHaveBeenCalled();
    expect(spies.quotes.findFxHistory).not.toHaveBeenCalled();
    expect(result.points.every((point) => point.fxRate === null)).toBe(true);
    expect(result.historyStartsAt).toBeNull();
  });

  it('SHOULD answer 404 WHEN the asset is missing OR belongs to someone else', async () => {
    spies.investments.findAssetById.mockResolvedValueOnce(undefined);
    spies.investments.findAssetById.mockResolvedValueOnce({ ...mocks.usDetail, ownerId: 'other' });

    await expect(setup.execute({ accessibleOwners: mocks.owners, id: 'a' })).rejects.toBeInstanceOf(
      NotFoundException,
    );
    await expect(setup.execute({ accessibleOwners: mocks.owners, id: 'a' })).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
