import { TransactionType } from '@finance/domain/enum';

import { LedgerEntry } from './index';

// region Mocks

function entry(accountId: string, type: TransactionType, value: number): LedgerEntry {
  return { accountId, type, value };
}

// Deterministic pseudo-random numbers (no faker) so the invariant test is reproducible.
function createRandom(seed: number) {
  let state = seed;

  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;

    return state / 4294967296;
  };
}

// endregion Mocks

const mocks = { accountA: 'account-a', accountB: 'account-b', createRandom, entry };
const spies = {};

export { mocks, spies };
