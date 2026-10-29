import { mocks, setup } from './index.mocks';

describe('GetBalanceSeriesUseCase', () => {
  it('SHOULD return the balance at the end of each month AND the planned one for the current month', async () => {
    mocks.accountRepository.findPaidSumsFrom.mockResolvedValue([
      { accountId: 'acc-1', amount: 4000, date: '2026-09-10' },
      { accountId: 'acc-1', amount: 1000, date: '2026-10-02' },
    ]);

    const series = await setup.execute(mocks.input);

    // The current month is split at today: the balance of today, then the planned end of the month.
    expect(series.points.map((point) => point.balance)).toEqual([65000, 69000, 70000, 72000]);
    expect(series.points.map((point) => point.projected)).toEqual([false, false, false, true]);
    expect(series.points[2]).toMatchObject({ end: '2026-10-20', start: '2026-10-01' });
    expect(series.points[3]).toMatchObject({ end: '2026-10-31', start: '2026-10-21' });
    expect(series.points[3].accounts).toEqual([{ balance: 72000, id: 'acc-1', name: 'Checking' }]);
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

  describe('archived accounts (spec 052, owner decision)', () => {
    const archived = {
      ...mocks.account,
      archivedAt: new Date('2026-09-15T15:00:00Z'),
      status: 'ARCHIVED' as never,
    };

    it('SHOULD leave an archived account out of every point, value and detail', async () => {
      mocks.accountRepository.findAccounts.mockResolvedValue([archived]);

      const series = await setup.execute(mocks.input);

      expect(series.points.map((point) => point.balance)).toEqual([0, 0, 0, 0]);
      expect(series.points.every((point) => point.accounts.length === 0)).toBe(true);
    });

    it('SHOULD keep counting the active accounts next to an archived one', async () => {
      mocks.accountRepository.findAccounts.mockResolvedValue([
        archived,
        { ...mocks.account, id: 'acc-2', ledgerBalance: 1000, name: 'Other' },
      ]);

      const series = await setup.execute(mocks.input);

      expect(series.points[0].accounts.map((account) => account.id)).toEqual(['acc-2']);
    });
  });

  it('SHOULD read the planned balances once for every future month of the period (spec 053)', async () => {
    mocks.daily.execute.mockResolvedValue({
      accounts: [mocks.account],
      days: [
        { accounts: [{ accountId: 'acc-1', balance: 72000 }], date: '2026-10-31' },
        { accounts: [{ accountId: 'acc-1', balance: 80000 }], date: '2026-11-30' },
        { accounts: [{ accountId: 'acc-1', balance: 90000 }], date: '2027-01-31' },
      ],
      month: '2026-10',
    });

    const series = await setup.execute({ ...mocks.input, to: '2027-01-31' });

    expect(mocks.daily.execute).toHaveBeenCalledTimes(1);
    expect(mocks.daily.execute).toHaveBeenCalledWith(
      expect.objectContaining({ month: '2026-10', untilMonth: '2027-01' }),
    );
    expect(series.points.filter((point) => point.projected).map((point) => point.balance)).toEqual([
      72000, 80000, 0, 90000,
    ]);
  });

  it('SHOULD mark every point projected for a period entirely in the future', async () => {
    const series = await setup.execute({ ...mocks.input, from: '2026-12-01', to: '2027-02-28' });

    expect(series.points.every((point) => point.projected)).toBe(true);
  });
});
