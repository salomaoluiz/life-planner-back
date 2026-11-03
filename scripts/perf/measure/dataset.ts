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
  // Unbounded on purpose: it counts every row, including any a read materialized.
  transactions: '/api/v1/finance/transactions',
};

// Size of every list of the base user. Reads only.
export async function measureDataset(
  client: Pick<ApiClient, 'get'>,
): Promise<Record<string, number>> {
  const sizes: Record<string, number> = {};
  for (const [name, path] of Object.entries(LISTS)) {
    sizes[name] = (await client.get<unknown[]>(path)).length;
  }

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
