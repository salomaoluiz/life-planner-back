import { TransactionType } from '@finance/domain/enum';

import { mocks, setup } from './index.mocks';

describe('GetDashboardSummaryUseCase', () => {
  it('SHOULD split income and expenses in realized and projected AND read the previous period', async () => {
    mocks.rows.execute.mockImplementation(async ({ from }: { from: string }) =>
      Promise.resolve(
        from === mocks.input.from
          ? [
              mocks.rowOf({ amount: 300 }),
              mocks.rowOf({ amount: 100, projected: true }),
              mocks.rowOf({ amount: 900, type: TransactionType.INCOME }),
            ]
          : [mocks.rowOf({ amount: 250 })],
      ),
    );

    const summary = await setup.execute(mocks.input);

    expect(summary.expense).toEqual({ previous: 250, projected: 100, realized: 300 });
    expect(summary.income).toEqual({ previous: 0, projected: 0, realized: 900 });
    expect(mocks.rows.execute).toHaveBeenCalledWith(
      expect.objectContaining({ from: '2024-11-01', to: '2025-10-31' }),
    );
  });

  it('SHOULD compute the balance today and the day before the period from the ledger', async () => {
    mocks.accountRepository.findPaidSumsFrom.mockResolvedValue([
      { accountId: 'acc-1', amount: 5000, date: '2026-03-01' },
      { accountId: 'acc-1', amount: 2000, date: '2026-10-25' },
    ]);

    const summary = await setup.execute(mocks.input);

    expect(summary.balance).toEqual({ current: 68000, previous: 63000, projectedEnd: 75000 });
    expect(mocks.accountRepository.findPaidSumsFrom).toHaveBeenCalledWith({
      accountIds: ['acc-1'],
      from: '2025-11-01',
    });
  });

  it('SHOULD leave an archived account out of both balances (spec 052, owner decision)', async () => {
    mocks.accountRepository.findAccounts.mockResolvedValue([
      {
        ...mocks.account,
        archivedAt: new Date('2026-10-10T15:00:00Z'),
        status: 'ARCHIVED' as never,
      },
    ]);
    mocks.accountRepository.findPaidSumsFrom.mockResolvedValue([
      { accountId: 'acc-1', amount: 5000, date: '2026-03-01' },
      { accountId: 'acc-1', amount: 2000, date: '2026-10-25' },
    ]);

    const summary = await setup.execute(mocks.input);

    expect(summary.balance).toEqual({ current: 0, previous: 0, projectedEnd: 0 });
  });

  it('SHOULD list the currencies in scope AND return zeros for a currency without accounts', async () => {
    const summary = await setup.execute({ ...mocks.input, currency: 'USD' });

    expect(summary.currencies).toEqual([expect.objectContaining({ accounts: 1, code: 'BRL' })]);
    expect(summary.balance).toEqual({ current: 0, previous: 0, projectedEnd: 0 });
    expect(summary.income.realized).toBe(0);
    expect(mocks.accountRepository.findPaidSumsFrom).not.toHaveBeenCalled();
  });

  it('SHOULD apply only the accounts part of the filters to the balance', async () => {
    const summary = await setup.execute({
      ...mocks.input,
      filter: { accountIds: ['other'], categoryIds: ['c'] },
    });

    expect(summary.balance).toEqual({ current: 0, previous: 0, projectedEnd: 0 });
  });

  it('SHOULD return empty data without owners', async () => {
    const summary = await setup.execute({ ...mocks.input, accessibleOwners: [] });

    expect(summary.currencies).toEqual([]);
    expect(summary.balance.current).toBe(0);
  });

  it('SHOULD return null as projected end WHEN the period ends today or before, without planning (spec 053)', async () => {
    const summary = await setup.execute({ ...mocks.input, to: '2026-10-20' });

    expect(summary.balance.projectedEnd).toBeNull();
    expect(mocks.daily.execute).not.toHaveBeenCalled();
  });

  it('SHOULD plan the month of the last day AND sum only the accounts in scope (spec 053)', async () => {
    const summary = await setup.execute({ ...mocks.input, to: '2027-03-31' });

    expect(mocks.daily.execute).toHaveBeenCalledWith(expect.objectContaining({ month: '2027-03' }));
    // No planned day for 2027-03-31 in the mock: nothing to sum.
    expect(summary.balance.projectedEnd).toBe(0);
  });

  it('SHOULD sum the planned balance of the accounts in scope on the last day (spec 053)', async () => {
    const summary = await setup.execute(mocks.input);

    expect(summary.balance.projectedEnd).toBe(75000);
  });
});

describe('no repeated reads (spec 083)', () => {
  it('SHOULD read the categories once AND hand categories AND cards to both period reads', async () => {
    const categories = [{ id: 'food' }] as never;

    mocks.loadCategories.execute.mockResolvedValue(categories);

    await setup.execute({ ...mocks.input, filter: { categoryIds: ['food'] } });

    expect(mocks.loadCategories.execute).toHaveBeenCalledTimes(1);
    expect(mocks.rows.execute).toHaveBeenCalledTimes(2);

    for (const [call] of mocks.rows.execute.mock.calls) {
      expect(call.preloaded.categories).toBe(categories);
      expect(call.preloaded.cards).toHaveLength(1);
    }
  });

  it('SHOULD hand its accounts AND cards to the planned balance', async () => {
    await setup.execute({ ...mocks.input, to: '2027-03-31' });

    const [call] = mocks.daily.execute.mock.calls[0];

    expect(call.preloaded.accounts).toEqual([mocks.account]);
    expect(call.preloaded.cards).toHaveLength(1);
  });
});
