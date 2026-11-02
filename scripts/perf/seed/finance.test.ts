import { seedFinance } from './finance';
import { createRng } from './random';

const cfg = {
  accounts: 6,
  archivedAccounts: 1,
  cards: 3,
  categories: 20,
  installmentPlans: 4,
  recurrences: 4,
  referenceMonthMin: 10,
  tags: 5,
  transactions: 60,
  years: 2,
};
const today = '2026-11-02';

type Row = Record<string, unknown>;

// In-memory API: just enough to prove the runner is idempotent and fails loudly.
function fakeApi() {
  const store: Record<string, Row[]> = {
    accounts: [],
    cards: [],
    categories: [],
    recurrences: [],
    tags: [],
    transactions: [],
  };
  let seq = 0;
  const writes: string[] = [];
  const paid = new Set<string>();
  const id = () => `id-${(seq += 1)}`;
  const collections: Record<string, string> = {
    '/api/v1/finance/accounts': 'accounts',
    '/api/v1/finance/categories': 'categories',
    '/api/v1/finance/credit-cards': 'cards',
    '/api/v1/finance/recurrences': 'recurrences',
    '/api/v1/finance/tags': 'tags',
    '/api/v1/finance/transactions': 'transactions',
  };

  const client = {
    get: jest.fn(async (path: string) => {
      if (collections[path]) return store[collections[path]];
      const invoice = path.match(/credit-cards\/(.+)\/invoices\/(.+)$/);
      if (invoice) {
        return { credits: [], invoice: { payment: paid.has(path) ? {} : null }, purchases: [{}] };
      }
      throw new Error(`unexpected GET ${path}`);
    }),
    patch: jest.fn(async (path: string, body: Row) => {
      writes.push(`PATCH ${path}`);
      const account = store.accounts.find((a) => path.endsWith(`/${a.id}`));
      if (account) account.status = body.status;

      return {};
    }),
    post: jest.fn(async (path: string, body?: Row) => {
      writes.push(`POST ${path}`);
      const key = collections[path.split('?')[0]];
      if (key) {
        const row = { ...body, id: id(), status: 'ACTIVE' };
        store[key].push(row);

        return row;
      }
      if (path.startsWith('/api/v1/finance/installment-plans') && path.endsWith('/prepayment')) {
        return {};
      }
      if (path.startsWith('/api/v1/finance/installment-plans')) {
        const plan = { id: id() };
        store.transactions.push({ description: body?.description, installmentPlanId: plan.id });

        return plan;
      }
      if (path.includes('/refunds') || path.includes('/early-payments')) {
        store.transactions.push({ description: body?.description });

        return {};
      }
      if (path.includes('/payment')) {
        paid.add(
          path
            .replace(/\/payment$/, '')
            .replace('/api/v1', '/api/v1')
            .replace(/^/, ''),
        );
        return {};
      }
      return {};
    }),
  };

  return { client, store, writes };
}

const refs = { familyIds: ['fam-1'], userId: 'user-1' };
const run = (client: unknown) => seedFinance(client as never, cfg, refs, today, createRng(64));

describe('seedFinance', () => {
  it('creates the volumes of the config and returns counts and reference month', async () => {
    const { client, store } = fakeApi();

    const result = await run(client);

    expect(store.categories).toHaveLength(20);
    expect(store.tags).toHaveLength(5);
    expect(store.accounts).toHaveLength(6);
    expect(store.cards).toHaveLength(3);
    expect(
      store.transactions.filter((t) => String(t.description).startsWith('Perf tx ')),
    ).toHaveLength(60);
    expect(store.accounts.filter((a) => a.status === 'ARCHIVED')).toHaveLength(1);
    expect(result.referenceMonth).toBe('2026-10');
    expect(result.counts.financeCreated).toBeGreaterThan(0);
  });

  it('creates 0 records on a second run', async () => {
    const { client, writes } = fakeApi();
    await run(client);
    const before = writes.length;

    const second = await run(client);

    expect(writes.length).toBe(before);
    expect(second.counts.financeCreated).toBe(0);
  });

  it('completes a partial earlier run with exactly the missing transactions', async () => {
    const { client, store } = fakeApi();
    await run(client);
    store.transactions = store.transactions.filter(
      (t) =>
        !String(t.description).startsWith('Perf tx ') ||
        Number(String(t.description).slice(8)) < 40,
    );

    await run(client);

    expect(
      store.transactions.filter((t) => String(t.description).startsWith('Perf tx ')),
    ).toHaveLength(60);
  });

  it('fails loudly with the endpoint and status, no body', async () => {
    const { client } = fakeApi();
    client.post.mockRejectedValueOnce(new Error('POST /api/v1/finance/categories -> 422'));

    await expect(run(client)).rejects.toThrow('POST /api/v1/finance/categories -> 422');
  });
});
