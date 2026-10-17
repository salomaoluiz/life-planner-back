import { TransactionType } from '@finance/domain/enum';

import { ledgerDeltas, LedgerEntry, signedValue } from './index';
import { mocks } from './index.mocks';

const { accountA, accountB, entry } = mocks;

describe('signedValue', () => {
  it('SHOULD be +value for INCOME AND -value for EXPENSE', () => {
    expect(signedValue({ type: TransactionType.INCOME, value: 500 })).toBe(500);
    expect(signedValue({ type: TransactionType.EXPENSE, value: 500 })).toBe(-500);
  });
});

describe('ledgerDeltas', () => {
  it('SHOULD ignore an unpaid entry on create AND delete', () => {
    expect(ledgerDeltas(undefined, entry(accountA, TransactionType.EXPENSE, 300, false))).toEqual(
      [],
    );
    expect(ledgerDeltas(entry(accountA, TransactionType.EXPENSE, 300, false), undefined)).toEqual(
      [],
    );
  });

  it('SHOULD move the ledger WHEN an entry turns paid OR unpaid', () => {
    const unpaid = entry(accountA, TransactionType.EXPENSE, 300, false);
    const paid = entry(accountA, TransactionType.EXPENSE, 300, true);

    expect(ledgerDeltas(unpaid, paid)).toEqual([{ accountId: accountA, delta: -300 }]);
    expect(ledgerDeltas(paid, unpaid)).toEqual([{ accountId: accountA, delta: 300 }]);
  });

  it('SHOULD NOT move the ledger WHEN the value of an unpaid entry changes', () => {
    expect(
      ledgerDeltas(
        entry(accountA, TransactionType.EXPENSE, 300, false),
        entry(accountA, TransactionType.EXPENSE, 500, false),
      ),
    ).toEqual([]);
  });

  it('SHOULD add the signed value on create', () => {
    expect(ledgerDeltas(undefined, entry(accountA, TransactionType.EXPENSE, 300))).toEqual([
      { accountId: accountA, delta: -300 },
    ]);
  });

  it('SHOULD reverse the signed value on delete', () => {
    expect(ledgerDeltas(entry(accountA, TransactionType.EXPENSE, 300), undefined)).toEqual([
      { accountId: accountA, delta: 300 },
    ]);
  });

  it('SHOULD sum the two sides into ONE increment WHEN the account is the same', () => {
    expect(
      ledgerDeltas(
        entry(accountA, TransactionType.EXPENSE, 1000),
        entry(accountA, TransactionType.EXPENSE, 1500),
      ),
    ).toEqual([{ accountId: accountA, delta: -500 }]);
  });

  it('SHOULD apply the full swing WHEN the type flips on the same account', () => {
    expect(
      ledgerDeltas(
        entry(accountA, TransactionType.EXPENSE, 50),
        entry(accountA, TransactionType.INCOME, 50),
      ),
    ).toEqual([{ accountId: accountA, delta: 100 }]);
  });

  it('SHOULD return nothing WHEN nothing changed (a zero delta is never written)', () => {
    const same = entry(accountA, TransactionType.INCOME, 700);

    expect(ledgerDeltas(same, { ...same })).toEqual([]);
    expect(ledgerDeltas(undefined, undefined)).toEqual([]);
  });

  it('SHOULD reverse on the old account AND apply on the new one WHEN the account changes', () => {
    expect(
      ledgerDeltas(
        entry(accountA, TransactionType.EXPENSE, 200),
        entry(accountB, TransactionType.EXPENSE, 200),
      ),
    ).toEqual([
      { accountId: accountA, delta: 200 },
      { accountId: accountB, delta: -200 },
    ]);
  });

  it('SHOULD always order the deltas by ascending account id (same lock order for A→B and B→A)', () => {
    const forward = ledgerDeltas(
      entry(accountA, TransactionType.EXPENSE, 10),
      entry(accountB, TransactionType.EXPENSE, 10),
    );
    const backward = ledgerDeltas(
      entry(accountB, TransactionType.EXPENSE, 10),
      entry(accountA, TransactionType.EXPENSE, 10),
    );

    expect(forward.map((item) => item.accountId)).toEqual([accountA, accountB]);
    expect(backward.map((item) => item.accountId)).toEqual([accountA, accountB]);
  });

  it('SHOULD keep ledger == initial + Σ signed(all) after a random sequence of creates, updates and deletes', () => {
    const random = mocks.createRandom(42);
    const accounts = [accountA, accountB, 'account-c'];
    const initial: Record<string, number> = { 'account-c': 0, [accountA]: 100, [accountB]: -50 };
    const ledger: Record<string, number> = { ...initial };
    const rows = new Map<number, LedgerEntry>();
    let nextId = 0;

    function randomEntry(): LedgerEntry {
      return {
        accountId: accounts[Math.floor(random() * accounts.length)],
        paid: random() < 0.7,
        type: random() < 0.5 ? TransactionType.INCOME : TransactionType.EXPENSE,
        value: 1 + Math.floor(random() * 10_000),
      };
    }
    function apply(before?: LedgerEntry, after?: LedgerEntry) {
      ledgerDeltas(before, after).forEach(({ accountId, delta }) => {
        ledger[accountId] += delta;
      });
    }

    for (let step = 0; step < 2000; step += 1) {
      const ids = [...rows.keys()];
      const roll = random();

      if (ids.length === 0 || roll < 0.4) {
        const created = randomEntry();
        rows.set(nextId, created);
        nextId += 1;
        apply(undefined, created);
      } else if (roll < 0.75) {
        const id = ids[Math.floor(random() * ids.length)];
        const updated = randomEntry();
        apply(rows.get(id), updated);
        rows.set(id, updated);
      } else {
        const id = ids[Math.floor(random() * ids.length)];
        apply(rows.get(id), undefined);
        rows.delete(id);
      }
    }

    accounts.forEach((accountId) => {
      const expected =
        initial[accountId] +
        [...rows.values()]
          .filter((row) => row.accountId === accountId && row.paid)
          .reduce((sum, row) => sum + signedValue(row), 0);

      expect(ledger[accountId]).toBe(expected);
    });
  });
});

describe('ledgerDeltas with card purchases (null account)', () => {
  it('SHOULD have no effect for a card purchase', () => {
    expect(
      ledgerDeltas(undefined, {
        accountId: null,
        paid: true,
        type: TransactionType.EXPENSE,
        value: 10,
      }),
    ).toEqual([]);
  });

  it('SHOULD restore the old account WHEN an account expense becomes a card purchase', () => {
    expect(
      ledgerDeltas(
        { accountId: 'a', paid: true, type: TransactionType.EXPENSE, value: 10 },
        { accountId: null, paid: true, type: TransactionType.EXPENSE, value: 10 },
      ),
    ).toEqual([{ accountId: 'a', delta: 10 }]);
  });
});
