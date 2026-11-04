import { TransactionType } from '@finance/domain/enum';

import {
  applyLedgerDeltas,
  assertInvoicesNotPaid,
  assertNoPaidInstallment,
  lockTransactionRow,
  lockWriteScope,
  sumLedgerDeltas,
  toLedgerEntry,
} from './index';
import { mocks, spies } from './index.mocks';

describe('lockWriteScope (spec 085)', () => {
  const raw = {
    account_id: 'acc-1',
    credit_card_id: 'card-1',
    invoice_month: '2026-10',
    owner: 'USER',
    owner_id: 'owner-1',
    paid: null,
    type: 'EXPENSE',
    value: 1000,
  };

  it('SHOULD lock the cards and THEN the row in ONE statement AND return the row with its owner', async () => {
    spies.queryRaw.mockResolvedValue([raw]);

    const result = await lockWriteScope(mocks.tx, { extraCardIds: [], rowId: 'tx-1' });

    expect(result).toEqual({
      accountId: 'acc-1',
      creditCardId: 'card-1',
      invoiceMonth: '2026-10',
      owner: 'USER',
      ownerId: 'owner-1',
      paid: false,
      type: TransactionType.EXPENSE,
      value: 1000,
    });
    expect(spies.queryRaw).toHaveBeenCalledTimes(1);
    const query = spies.queryRaw.mock.calls[0][0];
    const locks = [...query.sql.matchAll(/FOR UPDATE/g)].map((match) => match.index as number);
    expect(locks).toHaveLength(2);
    expect(query.sql.indexOf('"financial_credit_cards"')).toBeLessThan(locks[0]);
    expect(locks[0]).toBeLessThan(query.sql.lastIndexOf('"financial_transactions" t'));
    expect(query.sql).toContain('ORDER BY c."id" FOR UPDATE');
    expect(query.values).toEqual(['tx-1', 'tx-1']);
  });

  it('SHOULD also lock the cards the row is moving to, once and ordered by the database', async () => {
    spies.queryRaw.mockResolvedValue([raw]);

    await lockWriteScope(mocks.tx, { extraCardIds: ['card-b', 'card-a', 'card-b'], rowId: 'tx-1' });

    expect(spies.queryRaw.mock.calls[0][0].values).toEqual(['tx-1', 'card-a', 'card-b', 'tx-1']);
  });

  it('SHOULD return undefined WHEN the row does not exist', async () => {
    spies.queryRaw.mockResolvedValue([]);

    expect(await lockWriteScope(mocks.tx, { extraCardIds: [], rowId: 'gone' })).toBeUndefined();
  });
});

describe('toLedgerEntry', () => {
  it('SHOULD map a raw row to the domain entry', () => {
    expect(toLedgerEntry({ account_id: 'acc-1', paid: false, type: 'INCOME', value: 250 })).toEqual(
      {
        accountId: 'acc-1',
        paid: false,
        type: TransactionType.INCOME,
        value: 250,
      },
    );
  });
});

describe('lockTransactionRow', () => {
  it('SHOULD read the stored row with SELECT … FOR UPDATE by id AND return its ledger entry', async () => {
    spies.queryRaw.mockResolvedValue([
      { account_id: 'acc-1', paid: true, type: 'EXPENSE', value: 1000 },
    ]);

    const result = await lockTransactionRow(mocks.tx, 'tx-1');

    expect(result).toEqual({
      accountId: 'acc-1',
      paid: true,
      type: TransactionType.EXPENSE,
      value: 1000,
    });
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

describe('sumLedgerDeltas (spec 086)', () => {
  it('SHOULD sum per account, drop zero totals AND sort ascending by account id', () => {
    expect(
      sumLedgerDeltas([
        { accountId: 'acc-b', delta: -100 },
        { accountId: 'acc-a', delta: 50 },
        { accountId: 'acc-b', delta: -200 },
        { accountId: 'acc-c', delta: 70 },
        { accountId: 'acc-c', delta: -70 },
      ]),
    ).toEqual([
      { accountId: 'acc-a', delta: 50 },
      { accountId: 'acc-b', delta: -300 },
    ]);
  });

  it('SHOULD return nothing for no deltas', () => {
    expect(sumLedgerDeltas([])).toEqual([]);
  });
});
