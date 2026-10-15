import { TransactionType } from '@finance/domain/enum';

export interface LedgerDelta {
  accountId: string;
  delta: number;
}
// A null account (card purchase) has no ledger effect.
export interface LedgerEntry {
  accountId: null | string;
  type: TransactionType;
  value: number;
}

// `+value` for INCOME, `-value` for EXPENSE (balance adjustments included).
export function signedValue(entry: Pick<LedgerEntry, 'type' | 'value'>): number {
  return entry.type === TransactionType.INCOME ? entry.value : -entry.value;
}

// The increments to apply to each account's ledger balance for one transaction write:
// create = (undefined, after), delete = (before, undefined), update = (before, after).
// One entry per account (net), zero deltas dropped, ascending account id so concurrent writes lock
// the account rows in the same order.
export function ledgerDeltas(before?: LedgerEntry, after?: LedgerEntry): LedgerDelta[] {
  const totals = new Map<string, number>();

  if (before?.accountId) {
    totals.set(before.accountId, (totals.get(before.accountId) ?? 0) - signedValue(before));
  }
  if (after?.accountId) {
    totals.set(after.accountId, (totals.get(after.accountId) ?? 0) + signedValue(after));
  }

  return [...totals.entries()]
    .filter(([, delta]) => delta !== 0)
    .map(([accountId, delta]) => ({ accountId, delta }))
    .sort((a, b) => a.accountId.localeCompare(b.accountId));
}
