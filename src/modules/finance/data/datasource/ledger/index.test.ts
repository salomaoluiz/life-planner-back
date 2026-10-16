import { TransactionType } from '@finance/domain/enum';

import {
  applyLedgerDeltas,
  assertInvoicesNotPaid,
  assertNoPaidInstallment,
  lockTransactionRow,
  toLedgerEntry,
} from './index';
import { mocks, spies } from './index.mocks';

describe('toLedgerEntry', () => {
  it('SHOULD map a raw row to the domain entry', () => {
    expect(toLedgerEntry({ account_id: 'acc-1', type: 'INCOME', value: 250 })).toEqual({
      accountId: 'acc-1',
      type: TransactionType.INCOME,
      value: 250,
    });
  });
});

describe('lockTransactionRow', () => {
  it('SHOULD read the stored row with SELECT … FOR UPDATE by id AND return its ledger entry', async () => {
    spies.queryRaw.mockResolvedValue([{ account_id: 'acc-1', type: 'EXPENSE', value: 1000 }]);

    const result = await lockTransactionRow(mocks.tx, 'tx-1');

    expect(result).toEqual({ accountId: 'acc-1', type: TransactionType.EXPENSE, value: 1000 });
    expect(spies.queryRaw).toHaveBeenCalledTimes(1);
    const query = spies.queryRaw.mock.calls[0][0];
    expect(query.sql).toContain('FOR UPDATE');
    expect(query.sql).toContain('financial_transactions');
    expect(query.values).toEqual(['tx-1']);
  });

  it('SHOULD return undefined WHEN the row does not exist', async () => {
    spies.queryRaw.mockResolvedValue([]);

    expect(await lockTransactionRow(mocks.tx, 'missing')).toBeUndefined();
  });
});

describe('applyLedgerDeltas', () => {
  it('SHOULD increment each account atomically (no read-modify-write), in the given order', async () => {
    spies.accountUpdate.mockResolvedValue({});

    await applyLedgerDeltas(mocks.tx, [
      { accountId: 'acc-1', delta: 200 },
      { accountId: 'acc-2', delta: -200 },
    ]);

    expect(spies.accountUpdate).toHaveBeenNthCalledWith(1, {
      data: { ledger_balance: { increment: 200 } },
      where: { id: 'acc-1' },
    });
    expect(spies.accountUpdate).toHaveBeenNthCalledWith(2, {
      data: { ledger_balance: { increment: -200 } },
      where: { id: 'acc-2' },
    });
  });

  it('SHOULD do nothing for an empty list', async () => {
    await applyLedgerDeltas(mocks.tx, []);

    expect(spies.accountUpdate).not.toHaveBeenCalled();
  });
});

describe('assertInvoicesNotPaid / assertNoPaidInstallment', () => {
  it('SHOULD pass WHEN no listed invoice has a payment', async () => {
    spies.paymentFindFirst.mockResolvedValue(null);

    await expect(
      assertInvoicesNotPaid(mocks.tx, 'card-1', ['2026-10', '2026-11']),
    ).resolves.toBeUndefined();
    expect(spies.paymentFindFirst).toHaveBeenCalledWith({
      select: { id: true },
      where: { credit_card_id: 'card-1', invoice_month: { in: ['2026-10', '2026-11'] } },
    });
  });

  it('SHOULD say "Invoice is paid" for a target invoice', async () => {
    spies.paymentFindFirst.mockResolvedValue({ id: 'p1' });

    await expect(assertInvoicesNotPaid(mocks.tx, 'card-1', ['2026-10'])).rejects.toThrow(
      'Invoice is paid',
    );
  });

  it('SHOULD say "An installment is in a paid invoice" for an existing plan', async () => {
    spies.paymentFindFirst.mockResolvedValue({ id: 'p1' });

    await expect(assertNoPaidInstallment(mocks.tx, 'card-1', ['2026-10'])).rejects.toThrow(
      'An installment is in a paid invoice',
    );
  });
});
