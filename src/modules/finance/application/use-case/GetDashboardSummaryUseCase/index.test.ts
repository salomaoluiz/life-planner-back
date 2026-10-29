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

    expect(summary.balance).toEqual({ current: 68000, previous: 63000 });
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

    expect(summary.balance).toEqual({ current: 0, previous: 0 });
  });

  it('SHOULD list the currencies in scope AND return zeros for a currency without accounts', async () => {
    const summary = await setup.execute({ ...mocks.input, currency: 'USD' });

    expect(summary.currencies).toEqual([expect.objectContaining({ accounts: 1, code: 'BRL' })]);
    expect(summary.balance).toEqual({ current: 0, previous: 0 });
    expect(summary.income.realized).toBe(0);
    expect(mocks.accountRepository.findPaidSumsFrom).not.toHaveBeenCalled();
  });

  it('SHOULD apply only the accounts part of the filters to the balance', async () => {
    const summary = await setup.execute({
      ...mocks.input,
      filter: { accountIds: ['other'], categoryIds: ['c'] },
    });

    expect(summary.balance).toEqual({ current: 0, previous: 0 });
  });

  it('SHOULD return empty data without owners', async () => {
    const summary = await setup.execute({ ...mocks.input, accessibleOwners: [] });

    expect(summary.currencies).toEqual([]);
    expect(summary.balance.current).toBe(0);
  });
});
