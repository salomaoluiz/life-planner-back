import { Prisma } from '@db/client';

import { applyDeltas, ledgerDeltasFor, lockAccounts, lockAsset, reversalDeltas } from './index';

describe('ledgerDeltasFor', () => {
  it('SHOULD take the total out of the account for a new buy', () => {
    expect(ledgerDeltasFor(undefined, { accountId: 'a', type: 'EXPENSE', value: 500 })).toEqual([
      { accountId: 'a', delta: -500 },
    ]);
  });

  it('SHOULD add the received total for a new sell', () => {
    expect(ledgerDeltasFor(undefined, { accountId: 'a', type: 'INCOME', value: 700 })).toEqual([
      { accountId: 'a', delta: 700 },
    ]);
  });

  it('SHOULD net an edit on the same account AND drop a zero delta', () => {
    const before = { accountId: 'a', type: 'EXPENSE', value: 500 } as const;

    expect(ledgerDeltasFor(before, { ...before, value: 800 })).toEqual([
      { accountId: 'a', delta: -300 },
    ]);
    expect(ledgerDeltasFor(before, before)).toEqual([]);
  });

  it('SHOULD move the delta between accounts in ascending id order', () => {
    expect(
      ledgerDeltasFor(
        { accountId: 'b', type: 'EXPENSE', value: 500 },
        { accountId: 'a', type: 'EXPENSE', value: 500 },
      ),
    ).toEqual([
      { accountId: 'a', delta: -500 },
      { accountId: 'b', delta: 500 },
    ]);
  });

  it('SHOULD give the balance back when the row disappears', () => {
    expect(ledgerDeltasFor({ accountId: 'a', type: 'EXPENSE', value: 500 }, undefined)).toEqual([
      { accountId: 'a', delta: 500 },
    ]);
  });
});

describe('reversalDeltas', () => {
  it('SHOULD sum the reversal of many rows per account', () => {
    expect(
      reversalDeltas([
        { accountId: 'b', type: 'EXPENSE', value: 100 },
        { accountId: 'a', type: 'EXPENSE', value: 200 },
        { accountId: 'a', type: 'INCOME', value: 50 },
      ]),
    ).toEqual([
      { accountId: 'a', delta: -(-200 + 50) },
      { accountId: 'b', delta: 100 },
    ]);
  });
});

describe('database helpers', () => {
  const updateSpy = jest.fn();
  const queryRawSpy = jest.fn();
  const tx = {
    $queryRaw: queryRawSpy,
    financialAccount: { update: updateSpy },
  } as unknown as Prisma.TransactionClient;

  beforeEach(() => jest.clearAllMocks());

  it('SHOULD increment each account once in the given order', async () => {
    await applyDeltas(tx, [
      { accountId: 'a', delta: -5 },
      { accountId: 'b', delta: 7 },
    ]);

    expect(updateSpy).toHaveBeenNthCalledWith(1, {
      data: { ledger_balance: { increment: -5 } },
      where: { id: 'a' },
    });
    expect(updateSpy).toHaveBeenNthCalledWith(2, {
      data: { ledger_balance: { increment: 7 } },
      where: { id: 'b' },
    });
  });

  it('SHOULD lock the accounts only when there are some AND the asset always', async () => {
    await lockAccounts(tx, []);
    expect(queryRawSpy).not.toHaveBeenCalled();

    await lockAccounts(tx, ['b', 'a', 'b']);
    await lockAsset(tx, 'asset');
    expect(queryRawSpy).toHaveBeenCalledTimes(2);
  });
});
