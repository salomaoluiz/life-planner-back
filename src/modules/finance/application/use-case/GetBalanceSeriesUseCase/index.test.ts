import { mocks, setup } from './index.mocks';

describe('GetBalanceSeriesUseCase', () => {
  it('SHOULD return the balance at the end of each month AND the planned one for the current month', async () => {
    mocks.accountRepository.findPaidSumsFrom.mockResolvedValue([
      { accountId: 'acc-1', amount: 4000, date: '2026-09-10' },
      { accountId: 'acc-1', amount: 1000, date: '2026-10-02' },
    ]);

    const series = await setup.execute(mocks.input);

    expect(series.points.map((point) => point.balance)).toEqual([65000, 69000, 72000]);
    expect(series.points.map((point) => point.projected)).toEqual([false, false, true]);
    expect(series.points[2].accounts).toEqual([{ balance: 72000, id: 'acc-1', name: 'Checking' }]);
  });

  it('SHOULD not read the planned balances for a period that ended', async () => {
    await setup.execute({ ...mocks.input, to: '2026-09-30' });

    expect(mocks.daily.execute).not.toHaveBeenCalled();
  });

  it('SHOULD refuse a granularity the period does not allow', async () => {
    await expect(
      setup.execute({ ...mocks.input, from: '2026-06-01', granularity: 'DAY' }),
    ).rejects.toThrow('Granularity not allowed');
  });

  it('SHOULD return zeros for a currency without accounts', async () => {
    const series = await setup.execute({ ...mocks.input, currency: 'USD' });

    expect(series.points.every((point) => point.balance === 0 && point.accounts.length === 0)).toBe(
      true,
    );
    expect(mocks.accountRepository.findPaidSumsFrom).not.toHaveBeenCalled();
  });

  it('SHOULD keep only the filtered accounts', async () => {
    const series = await setup.execute({ ...mocks.input, filter: { accountIds: ['other'] } });

    expect(series.points[0].balance).toBe(0);
  });
});
