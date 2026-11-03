import { measureDataset, verifyDataset } from './dataset';

const PATHS: Record<string, string> = {
  '/api/v1/families': 'families',
  '/api/v1/finance/accounts': 'accounts',
  '/api/v1/finance/categories': 'categories',
  '/api/v1/finance/credit-cards': 'cards',
  '/api/v1/finance/recurrences': 'recurrences',
  '/api/v1/finance/tags': 'tags',
  '/api/v1/finance/transactions': 'transactions',
  '/api/v1/stock/items': 'stock',
};

function clientWith(sizes: Record<string, number>): never {
  return {
    get: jest.fn(async (path: string) =>
      Array.from({ length: sizes[PATHS[path]] ?? 0 }, (_, i) => ({ id: i })),
    ),
  } as never;
}

const sizes = {
  accounts: 18,
  cards: 5,
  categories: 120,
  families: 3,
  recurrences: 20,
  stock: 1000,
  tags: 30,
  transactions: 11200,
};

describe('measureDataset', () => {
  it('SHOULD return the size of every list of the base user', async () => {
    expect(await measureDataset(clientWith(sizes))).toEqual(sizes);
  });
});

describe('verifyDataset', () => {
  it('SHOULD pass WHEN the lists match the fingerprint', async () => {
    await expect(
      verifyDataset(clientWith(sizes), { fingerprint: { ...sizes } }),
    ).resolves.toBeUndefined();
  });

  it('SHOULD name the first list that drifted AND how to fix it', async () => {
    await expect(
      verifyDataset(clientWith({ ...sizes, recurrences: 21 }), { fingerprint: { ...sizes } }),
    ).rejects.toThrow(
      'perf dataset drifted (recurrences: expected 20, found 21): run yarn perf:seed --reset',
    );
  });

  it('SHOULD report drift, not crash, WHEN the account is empty', async () => {
    await expect(verifyDataset(clientWith({}), { fingerprint: { ...sizes } })).rejects.toThrow(
      'perf dataset drifted (accounts: expected 18, found 0)',
    );
  });

  it('SHOULD ask for a seed WHEN the manifest has no fingerprint', async () => {
    await expect(verifyDataset(clientWith(sizes), {})).rejects.toThrow(
      'perf dataset has no fingerprint: run yarn perf:seed --reset',
    );
  });
});
