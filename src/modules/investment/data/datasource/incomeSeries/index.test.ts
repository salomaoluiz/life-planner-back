import { syncIncomeSeries } from './index';
import { mocks, spies, tx } from './index.mocks';

describe('syncIncomeSeries (spec 115 FR 20)', () => {
  it('SHOULD do nothing WHEN the asset has no active series', async () => {
    spies.seriesFindMany.mockResolvedValue([]);

    await syncIncomeSeries(tx, 'asset-1');

    expect(spies.operationFindMany).not.toHaveBeenCalled();
  });

  it('SHOULD recompute the quantity AND net amount of a planned occurrence AND its finance row after a buy', async () => {
    spies.operationFindMany.mockResolvedValue([
      mocks.buy,
      mocks.operation('2026-11-01', 'BUY', '20', 'op-2'),
    ]);
    spies.incomeFindMany.mockResolvedValue([mocks.planned(23, '2026-11-15', '2026-11-07')]);

    await syncIncomeSeries(tx, 'asset-1');

    expect(spies.incomeUpdate).toHaveBeenCalledWith({
      data: { net_amount: 13200, quantity: '120.00000000' },
      where: { id: 'inc-23' },
    });
    expect(spies.transactionUpdate).toHaveBeenCalledWith({
      data: { value: 13200 },
      where: { id: 'tx-23' },
    });
    expect(spies.seriesUpdate).not.toHaveBeenCalled();
  });

  it('SHOULD leave a planned occurrence alone WHEN nothing changed', async () => {
    spies.incomeFindMany.mockResolvedValue([mocks.planned(23, '2026-11-15', '2026-11-07')]);

    await syncIncomeSeries(tx, 'asset-1');

    expect(spies.incomeUpdate).not.toHaveBeenCalled();
  });

  it('SHOULD end the series AND delete the planned ones from the first with no position (spec 115 FR 11)', async () => {
    spies.operationFindMany.mockResolvedValue([
      mocks.buy,
      mocks.operation('2026-11-05', 'SELL', '100', 'op-2'),
    ]);
    spies.incomeFindMany.mockResolvedValue([mocks.planned(23, '2026-11-15', '2026-11-07')]);

    await syncIncomeSeries(tx, 'asset-1');

    expect(spies.incomeDeleteMany).toHaveBeenCalledWith({ where: { id: { in: ['inc-23'] } } });
    expect(spies.transactionDeleteMany).toHaveBeenCalledWith({ where: { id: { in: ['tx-23'] } } });
    expect(spies.seriesUpdate).toHaveBeenCalledWith({
      data: { end_reason: 'POSITION_ZERO', ended_at: new Date('2026-11-15T00:00:00Z') },
      where: { id: 'series-1' },
    });
  });

  it('SHOULD end the series at the next occurrence WHEN no planned one is left to tell (projected)', async () => {
    spies.operationFindMany.mockResolvedValue([
      mocks.buy,
      mocks.operation('2026-11-20', 'SELL', '100', 'op-2'),
    ]);

    await syncIncomeSeries(tx, 'asset-1');

    expect(spies.incomeDeleteMany).not.toHaveBeenCalled();
    expect(spies.seriesUpdate).toHaveBeenCalledWith({
      data: { end_reason: 'POSITION_ZERO', ended_at: new Date('2026-12-15T00:00:00Z') },
      where: { id: 'series-1' },
    });
  });

  it('SHOULD keep the series going WHEN the position stays WHILE the walk reaches its end date', async () => {
    spies.seriesFindMany.mockResolvedValue([
      { ...mocks.series, end_date: new Date('2026-12-20T00:00:00Z') },
    ]);
    spies.operationFindMany.mockResolvedValue([
      mocks.buy,
      mocks.operation('2026-12-30', 'BUY', '10', 'op-2'),
    ]);

    await syncIncomeSeries(tx, 'asset-1');

    expect(spies.seriesUpdate).not.toHaveBeenCalled();
  });
});
