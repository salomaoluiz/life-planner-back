import { INT4_MAX } from '@finance/application/dto/FinanceCommon';

import {
  CreateTransactionApiSchema,
  TransactionApiSchema,
  TransactionItemApiSchema,
  TransactionPageApiSchema,
  TransactionWithLookupsApiSchema,
  UpdateTransactionApiSchema,
} from './transaction.dto';

const uuid = '6f1c2b9e-1d2a-4c55-9a7e-0b8e3c1f2a10';
const valid = {
  accountId: uuid,
  categoryId: '1d0f8a3b-5c6e-4f70-8a91-b2c3d4e5f607',
  date: '2026-10-03',
  description: 'Weekly groceries',
  owner: 'USER',
  ownerId: '0b6a1e7c-3f4d-4b2a-8c9d-1e2f3a4b5c6d',
  type: 'EXPENSE',
  value: 23490,
};

describe('CreateTransactionApiSchema', () => {
  it('SHOULD accept the spec example AND the maximum value', () => {
    expect(CreateTransactionApiSchema.parse(valid)).toEqual(valid);
    expect(CreateTransactionApiSchema.safeParse({ ...valid, value: INT4_MAX }).success).toBe(true);
  });

  it('SHOULD trim the description', () => {
    expect(
      CreateTransactionApiSchema.parse({ ...valid, description: '  Lunch ' }).description,
    ).toBe('Lunch');
  });

  it.each([
    ['12.5', { value: 12.5 }],
    ['0', { value: 0 }],
    ['-100', { value: -100 }],
    ['above int4', { value: INT4_MAX + 1 }],
    ['a numeric string', { value: '234.90' }],
    ['2026-02-30', { date: '2026-02-30' }],
    ['2026-13-01', { date: '2026-13-01' }],
    ['2026-10-3', { date: '2026-10-3' }],
    ['an ISO timestamp', { date: '2026-10-03T10:00:00.000Z' }],
    ['neither accountId nor creditCardId', { accountId: undefined }],
    ['both accountId and creditCardId', { creditCardId: uuid }],
    ['a non-uuid categoryId', { categoryId: 'abc' }],
    ['an empty description', { description: '' }],
    ['a 201-character description', { description: 'a'.repeat(201) }],
    ['an unknown type', { type: 'TRANSFER' }],
  ])('SHOULD reject %s', (_label, patch) => {
    expect(CreateTransactionApiSchema.safeParse({ ...valid, ...patch }).success).toBe(false);
  });
});

describe('UpdateTransactionApiSchema', () => {
  it('SHOULD accept any subset, including owner and ownerId (transactions may move owner)', () => {
    expect(UpdateTransactionApiSchema.parse({ value: 100 })).toEqual({ value: 100 });
    expect(UpdateTransactionApiSchema.parse({ owner: 'FAMILY', ownerId: valid.ownerId })).toEqual({
      owner: 'FAMILY',
      ownerId: valid.ownerId,
    });
  });

  it.each([
    ['an empty body', {}],
    ['an unknown key', { foo: 1 }],
    ['null on a required field', { value: null }],
    ['value 0', { value: 0 }],
    ['an impossible date', { date: '2026-04-31' }],
  ])('SHOULD reject %s', (_label, body) => {
    expect(UpdateTransactionApiSchema.safeParse(body).success).toBe(false);
  });
});

it('SHOULD require systemKey (nullable) AND excludeFromTotals on the category summary', () => {
  const id = '0b6a1e7c-3f4d-4b2a-8c9d-1e2f3a4b5c6d';
  const category = {
    excludeFromTotals: true,
    icon: 'scale-balance',
    iconColor: '#607D8B',
    id,
    name: 'Balance adjustment',
    systemKey: 'BALANCE_ADJUSTMENT',
  };
  const output = {
    account: { icon: 'bank', id, name: 'Checking' },
    accountId: id,
    category,
    categoryId: id,
    createdAt: '2026-10-15T12:00:00.000Z',
    creditCard: null,
    creditCardId: null,
    currency: 'BRL',
    date: '2026-10-15',
    description: 'Balance adjustment',
    earlyPayment: null,
    id,
    installmentCount: null,
    installmentNumber: null,
    installmentPlanId: null,
    invoiceMonth: null,
    notes: null,
    occurrenceCount: null,
    occurrenceNumber: null,
    owner: 'USER',
    ownerId: id,
    paid: true,
    projected: false,
    recurrenceFrequency: null,
    recurrenceId: null,
    tags: [],
    type: 'INCOME',
    updatedAt: '2026-10-15T12:00:00.000Z',
    value: 5000,
  };

  expect(TransactionApiSchema.safeParse(output).success).toBe(true);
  expect(
    TransactionApiSchema.safeParse({ ...output, category: { ...category, systemKey: null } })
      .success,
  ).toBe(true);
  expect(
    TransactionApiSchema.safeParse({ ...output, category: { ...category, systemKey: 'OTHER' } })
      .success,
  ).toBe(false);
  expect(
    TransactionApiSchema.safeParse({ ...output, category: { ...category, systemKey: undefined } })
      .success,
  ).toBe(false);
  expect(
    TransactionApiSchema.safeParse({
      ...output,
      category: { ...category, excludeFromTotals: undefined },
    }).success,
  ).toBe(false);
});

describe('card purchases (spec 029)', () => {
  const base = { ...valid, accountId: undefined };

  it('SHOULD accept a create body with creditCardId only', () => {
    expect(CreateTransactionApiSchema.safeParse({ ...base, creditCardId: uuid }).success).toBe(
      true,
    );
  });

  it('SHOULD reject a patch with both sources AND accept either', () => {
    expect(
      UpdateTransactionApiSchema.safeParse({ accountId: uuid, creditCardId: uuid }).success,
    ).toBe(false);
    expect(UpdateTransactionApiSchema.safeParse({ creditCardId: uuid }).success).toBe(true);
    expect(UpdateTransactionApiSchema.safeParse({ accountId: uuid }).success).toBe(true);
  });
});

describe('UpdateTransactionApiSchema scope (spec 030)', () => {
  it('SHOULD accept ONLY_THIS and THIS_AND_NEXT AND reject anything else', () => {
    expect(UpdateTransactionApiSchema.safeParse({ scope: 'ONLY_THIS', value: 5 }).success).toBe(
      true,
    );
    expect(UpdateTransactionApiSchema.safeParse({ scope: 'THIS_AND_NEXT', value: 5 }).success).toBe(
      true,
    );
    expect(UpdateTransactionApiSchema.safeParse({ scope: 'ALL', value: 5 }).success).toBe(false);
  });
});

describe('notes (spec 059)', () => {
  it('SHOULD trim the ends, keep line breaks AND turn empty or null into null', () => {
    expect(CreateTransactionApiSchema.parse({ ...valid, notes: '  Casa\nAeroporto  ' }).notes).toBe(
      'Casa\nAeroporto',
    );
    expect(CreateTransactionApiSchema.parse({ ...valid, notes: '   ' }).notes).toBeNull();
    expect(CreateTransactionApiSchema.parse({ ...valid, notes: null }).notes).toBeNull();
    expect(CreateTransactionApiSchema.parse(valid).notes).toBeUndefined();
  });

  it('SHOULD allow 1000 characters (plus trailing spaces) AND refuse 1001', () => {
    expect(
      CreateTransactionApiSchema.safeParse({ ...valid, notes: `${'a'.repeat(1000)}     ` }).success,
    ).toBe(true);
    expect(
      CreateTransactionApiSchema.safeParse({ ...valid, notes: 'a'.repeat(1001) }).success,
    ).toBe(false);
  });

  it('SHOULD let an update clear the notes on its own', () => {
    expect(UpdateTransactionApiSchema.parse({ notes: null })).toEqual({ notes: null });
  });
});

describe('lean transaction payload (spec 079)', () => {
  const categoryId = '1d0f8a3b-5c6e-4f70-8a91-b2c3d4e5f607';
  const item = {
    accountId: uuid,
    categoryId,
    currency: 'BRL',
    date: '2026-11-03',
    description: 'Groceries',
    id: '2a9f4c1e-7b3d-4e68-9c05-6d7e8f901a2b',
    owner: 'USER',
    ownerId: '0b6a1e7c-3f4d-4b2a-8c9d-1e2f3a4b5c6d',
    paid: true,
    tagIds: ['5c4b3a29-1807-4f6e-8d9c-0a1b2c3d4e5f'],
    type: 'EXPENSE',
    value: 1250,
  };
  const lookups = {
    accounts: { [uuid]: { icon: 'bank', name: 'Checking' } },
    categories: { [categoryId]: { icon: 'cart', iconColor: '#888888', name: 'Food' } },
    creditCards: {},
    tags: { '5c4b3a29-1807-4f6e-8d9c-0a1b2c3d4e5f': { name: 'home' } },
  };

  it('SHOULD accept the spec example as an item, a page and an item with lookups', () => {
    expect(TransactionItemApiSchema.safeParse(item).success).toBe(true);
    expect(
      TransactionPageApiSchema.safeParse({ items: [item], lookups, nextCursor: null }).success,
    ).toBe(true);
    expect(TransactionWithLookupsApiSchema.safeParse({ item, lookups }).success).toBe(true);
  });

  it.each([
    ['createdAt', { createdAt: '2026-11-03T10:00:00.000Z' }],
    ['updatedAt', { updatedAt: '2026-11-03T10:00:00.000Z' }],
    ['a nested category', { category: { id: categoryId, name: 'Food' } }],
    ['a nested account', { account: null }],
    ['tags objects', { tags: [] }],
    ['a null field', { notes: null }],
  ])('SHOULD reject %s on an item', (_label, patch) => {
    expect(TransactionItemApiSchema.safeParse({ ...item, ...patch }).success).toBe(false);
  });

  it('SHOULD require lookups on a page', () => {
    expect(TransactionPageApiSchema.safeParse({ items: [item], nextCursor: null }).success).toBe(
      false,
    );
  });
});

describe('invoiceMonth (spec 095)', () => {
  const card = { ...valid, accountId: undefined, creditCardId: uuid };

  it('SHOULD accept YYYY-MM on create AND update', () => {
    expect(CreateTransactionApiSchema.safeParse({ ...card, invoiceMonth: '2026-11' }).success).toBe(
      true,
    );
    expect(UpdateTransactionApiSchema.safeParse({ invoiceMonth: '2026-11' }).success).toBe(true);
  });

  it.each(['2026-13', '2026-1', '2026-11-01', 'nov'])('SHOULD refuse %s', (invoiceMonth) => {
    expect(CreateTransactionApiSchema.safeParse({ ...card, invoiceMonth }).success).toBe(false);
    expect(UpdateTransactionApiSchema.safeParse({ invoiceMonth }).success).toBe(false);
  });
});
