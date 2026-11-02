import type { ApiClient } from '../seed/client';

import type { Fixtures } from './fixtures';

export interface Prepared {
  cleanup(): Promise<void>;
  onResponse?(body: unknown): void;
  request: { body?: unknown; method: string; path: string };
}

export type Recipe = (client: ApiClient, fx: Fixtures) => Promise<Prepared>;

type Body = (client: ApiClient, fx: Fixtures, suffix: string) => Promise<unknown> | unknown;

const FINANCE = '/api/v1/finance';

function probeName(): string {
  return `Perf probe ${Math.random().toString(36).slice(2, 8)}`;
}

async function accountAndCategory(client: ApiClient) {
  const [account] = await client.get<
    { currency: string; id: string; owner: string; ownerId: string }[]
  >(`${FINANCE}/accounts`);
  const categories = await client.get<{ id: string; type: string }[]>(`${FINANCE}/categories`);
  const category = categories.find((row) => row.type === 'EXPENSE');
  if (!account || !category) throw new Error('perf dataset has no account or expense category');

  return { account, category };
}

async function ignoreMissing(promise: Promise<unknown>): Promise<void> {
  await promise.catch(() => undefined);
}

// create: measures the POST. patch / delete: create a record first (outside the measurement).
function crud(base: string, createBody: Body, patchBody: Record<string, unknown>) {
  return {
    create: async (client: ApiClient, fx: Fixtures): Promise<Prepared> => {
      let id: string | undefined;

      return {
        cleanup: async () => {
          if (id) await client.delete(`${base}/${id}`);
        },
        onResponse: (body) => {
          id = (body as { id?: string } | undefined)?.id;
        },
        request: { body: await createBody(client, fx, probeName()), method: 'POST', path: base },
      };
    },
    delete: async (client: ApiClient, fx: Fixtures): Promise<Prepared> => {
      const { id } = await client.post<{ id: string }>(
        base,
        await createBody(client, fx, probeName()),
      );

      return {
        cleanup: () => ignoreMissing(client.delete(`${base}/${id}`)),
        request: { method: 'DELETE', path: `${base}/${id}` },
      };
    },
    patch: async (client: ApiClient, fx: Fixtures): Promise<Prepared> => {
      const { id } = await client.post<{ id: string }>(
        base,
        await createBody(client, fx, probeName()),
      );

      return {
        cleanup: () => ignoreMissing(client.delete(`${base}/${id}`)),
        request: { body: patchBody, method: 'PATCH', path: `${base}/${id}` },
      };
    },
  };
}

const stock = crud(
  '/api/v1/stock/items',
  (_client, fx, name) => ({
    brand: 'Perf',
    description: name,
    expirationDate: null,
    notes: null,
    owner: 'USER',
    ownerId: fx.userId,
    purchaseDate: `${fx.referenceMonth}-01T00:00:00.000Z`,
    quantity: 1,
    unit: 'unit',
  }),
  { quantity: 2 },
);

const account = crud(
  `${FINANCE}/accounts`,
  (_client, fx, name) => ({
    currency: 'BRL',
    icon: 'bank',
    initialBalance: 0,
    name,
    owner: 'USER',
    ownerId: fx.userId,
  }),
  { name: 'Perf probe renamed' },
);

const category = crud(
  `${FINANCE}/categories`,
  (_client, _fx, name) => ({
    icon: 'star',
    iconColor: '#336699',
    name,
    owner: 'ALL',
    type: 'EXPENSE',
  }),
  { name: 'Perf probe renamed' },
);

const tag = crud(`${FINANCE}/tags`, (_client, _fx, name) => ({ name, owner: 'ALL' }), {
  name: 'Perf probe renamed',
});

const transaction = crud(
  `${FINANCE}/transactions`,
  async (client, fx, name) => {
    const found = await accountAndCategory(client);

    return {
      accountId: found.account.id,
      categoryId: found.category.id,
      date: `${fx.referenceMonth}-15`,
      description: name,
      owner: found.account.owner,
      ownerId: found.account.ownerId,
      paid: false,
      type: 'EXPENSE',
      value: 100,
    };
  },
  { description: 'Perf probe renamed' },
);

const card = crud(
  `${FINANCE}/credit-cards`,
  (_client, fx, name) => ({
    brand: 'OTHER',
    closingDay: 5,
    color: '#336699',
    dueDay: 15,
    lastDigits: '0000',
    limit: 100_000,
    owner: 'USER',
    ownerId: fx.userId,
    title: name,
  }),
  { title: 'Perf probe renamed' },
);

const family = crud('/api/v1/families', (_client, _fx, name) => ({ name }), {
  name: 'Perf probe renamed',
});

const recurrenceBase = `${FINANCE}/recurrences`;
const recurrenceBody: Body = async (client, fx, name) => {
  const found = await accountAndCategory(client);

  return {
    accountId: found.account.id,
    categoryId: found.category.id,
    date: `${fx.referenceMonth}-15`,
    description: name,
    frequency: 'MONTHLY',
    owner: found.account.owner,
    ownerId: found.account.ownerId,
    type: 'EXPENSE',
    value: 100,
  };
};
const recurrence = crud(recurrenceBase, recurrenceBody, { description: 'Perf probe renamed' });

export const RECIPES: Record<string, Recipe> = {
  'account.create': account.create,
  'account.delete': account.delete,
  'account.patch': account.patch,
  'card.create': card.create,
  'card.delete': card.delete,
  'card.patch': card.patch,
  'category.create': category.create,
  'category.delete': category.delete,
  'category.patch': category.patch,
  'family.create': family.create,
  'family.delete': family.delete,
  'family.patch': family.patch,
  'recurrence.create': recurrence.create,
  'recurrence.delete': recurrence.delete,
  'stock.create': stock.create,
  'stock.delete': stock.delete,
  'stock.patch': stock.patch,
  'tag.create': tag.create,
  'tag.delete': tag.delete,
  'tag.patch': tag.patch,
  'transaction.create': transaction.create,
  'transaction.delete': transaction.delete,
  'transaction.patch': transaction.patch,
};
