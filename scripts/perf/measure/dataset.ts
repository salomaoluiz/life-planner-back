import type { ApiClient } from '../seed/client';
import type { SeedManifest } from '../seed/manifest';

const LISTS: Record<string, string> = {
  accounts: '/api/v1/finance/accounts',
  cards: '/api/v1/finance/credit-cards',
  categories: '/api/v1/finance/categories',
  families: '/api/v1/families',
  recurrences: '/api/v1/finance/recurrences',
  stock: '/api/v1/stock/items',
  tags: '/api/v1/finance/tags',
};

// The transactions list needs a period of at most 2 years (spec 078): the windows tile 2015..2034, so every row counts
// once, including any a read materialized.
const TRANSACTION_WINDOWS = Array.from({ length: 10 }, (_, i) => ({
  from: `${2015 + i * 2}-01-01`,
  to: `${2016 + i * 2}-12-31`,
}));
const TRANSACTIONS_PATH = '/api/v1/finance/transactions';
const PAGE_LIMIT = 500;

interface TransactionsPage {
  items: unknown[];
  nextCursor: null | string;
}

async function countTransactions(client: Pick<ApiClient, 'get'>): Promise<number> {
  let total = 0;
  for (const { from, to } of TRANSACTION_WINDOWS) {
    let cursor: null | string = null;
    do {
      const page: TransactionsPage = await client.get<TransactionsPage>(
        `${TRANSACTIONS_PATH}?from=${from}&to=${to}&limit=${PAGE_LIMIT}${
          cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''
        }`,
      );
      total += page.items.length;
      cursor = page.nextCursor;
    } while (cursor);
  }

  return total;
}

// Size of every list of the base user. Reads only.
export async function measureDataset(
  client: Pick<ApiClient, 'get'>,
): Promise<Record<string, number>> {
  const sizes: Record<string, number> = {};
  for (const [name, path] of Object.entries(LISTS)) {
    sizes[name] = (await client.get<unknown[]>(path)).length;
  }
  sizes.transactions = await countTransactions(client);

  return sizes;
}

// Perf tests only read, so the dataset must still be the seeded one; anything else makes the numbers meaningless.
export async function verifyDataset(
  client: Pick<ApiClient, 'get'>,
  manifest: Partial<Pick<SeedManifest, 'fingerprint'>>,
): Promise<void> {
  if (!manifest.fingerprint) {
    throw new Error('perf dataset has no fingerprint: run yarn perf:seed --reset');
  }
  const found = await measureDataset(client);
  for (const [name, expected] of Object.entries(manifest.fingerprint)) {
    if (found[name] !== expected) {
      throw new Error(
        `perf dataset drifted (${name}: expected ${expected}, found ${found[name]}): run yarn perf:seed --reset`,
      );
    }
  }
}
