import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { Fixtures } from './fixtures';
import { RECIPES } from './recipes';

const fx: Fixtures = {
  account: 'acc-1',
  card: 'card-1',
  category: 'cat-1',
  family: 'fam-1',
  plan: undefined,
  recurrence: undefined,
  referenceMonth: '2026-02',
  stockItem: undefined,
  tag: undefined,
  userId: 'user-1',
};

function fakeClient() {
  return {
    delete: jest.fn().mockResolvedValue(undefined),
    get: jest.fn(async (path: string) => {
      if (path.endsWith('/accounts')) {
        return [{ currency: 'BRL', id: 'acc-1', owner: 'USER', ownerId: 'user-1' }];
      }
      if (path.endsWith('/categories')) {
        return [
          { id: 'cat-in', type: 'INCOME' },
          { id: 'cat-1', type: 'EXPENSE' },
        ];
      }

      return [];
    }),
    patch: jest.fn().mockResolvedValue({}),
    post: jest.fn().mockResolvedValue({ id: 'new-1' }),
  };
}

const FAMILIES = [
  ['stock', '/api/v1/stock/items'],
  ['account', '/api/v1/finance/accounts'],
  ['category', '/api/v1/finance/categories'],
  ['tag', '/api/v1/finance/tags'],
  ['transaction', '/api/v1/finance/transactions'],
  ['card', '/api/v1/finance/credit-cards'],
  ['family', '/api/v1/families'],
] as const;

describe.each(FAMILIES)('%s recipes', (name, base) => {
  it('SHOULD measure the POST and delete the created record in cleanup', async () => {
    const client = fakeClient();

    const prepared = await RECIPES[`${name}.create`](client as never, fx);
    expect(prepared.request).toMatchObject({ method: 'POST', path: base });
    expect(client.post).not.toHaveBeenCalled();
    prepared.onResponse?.({ id: 'new-1' });
    await prepared.cleanup();

    expect(client.delete).toHaveBeenCalledWith(`${base}/new-1`);
  });

  it('SHOULD not delete anything WHEN the measured call never created a record', async () => {
    const client = fakeClient();

    const prepared = await RECIPES[`${name}.create`](client as never, fx);
    await prepared.cleanup();

    expect(client.delete).not.toHaveBeenCalled();
  });

  it('SHOULD create a record first, measure the PATCH and delete it in cleanup', async () => {
    const client = fakeClient();

    const prepared = await RECIPES[`${name}.patch`](client as never, fx);
    await prepared.cleanup();

    expect(client.post).toHaveBeenCalledWith(base, expect.anything());
    expect(prepared.request).toMatchObject({ method: 'PATCH', path: `${base}/new-1` });
    expect(client.delete).toHaveBeenCalledWith(`${base}/new-1`);
  });

  it('SHOULD create a record first, measure the DELETE and tolerate it being gone in cleanup', async () => {
    const client = fakeClient();
    client.delete.mockRejectedValue(new Error('DELETE -> 404'));

    const prepared = await RECIPES[`${name}.delete`](client as never, fx);

    expect(prepared.request).toMatchObject({ method: 'DELETE', path: `${base}/new-1` });
    await expect(prepared.cleanup()).resolves.toBeUndefined();
  });
});

describe('recurrence recipes', () => {
  it('SHOULD create on an account with an expense category and clean up', async () => {
    const client = fakeClient();

    const prepared = await RECIPES['recurrence.create'](client as never, fx);
    prepared.onResponse?.({ id: 'rec-1' });
    await prepared.cleanup();

    expect(prepared.request).toMatchObject({
      body: expect.objectContaining({ accountId: 'acc-1', categoryId: 'cat-1', type: 'EXPENSE' }),
      method: 'POST',
      path: '/api/v1/finance/recurrences',
    });
    expect(client.delete).toHaveBeenCalledWith('/api/v1/finance/recurrences/rec-1');
  });

  it('SHOULD create then measure the DELETE of a recurrence', async () => {
    const client = fakeClient();

    const prepared = await RECIPES['recurrence.delete'](client as never, fx);

    expect(prepared.request).toMatchObject({
      method: 'DELETE',
      path: '/api/v1/finance/recurrences/new-1',
    });
  });
});

describe('registry', () => {
  it('SHOULD only reference recipes that exist', () => {
    const dir = join(__dirname, '../../../perf/budgets');
    for (const file of ['finance', 'stock', 'family', 'user', 'version', 'health']) {
      const entries = JSON.parse(readFileSync(join(dir, `${file}.json`), 'utf8')) as Record<
        string,
        { recipe?: string }
      >;
      for (const [key, entry] of Object.entries(entries)) {
        if (entry.recipe) expect({ key, ok: entry.recipe in RECIPES }).toEqual({ key, ok: true });
      }
    }
  });
});
