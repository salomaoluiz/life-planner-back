import { Prisma } from '@db/client';

import { IncomeMapper, toDecimalString } from './index';

function decimal(value: string) {
  return new Prisma.Decimal(value);
}

it('SHOULD print stored decimals in the shortest form', () => {
  expect(toDecimalString(decimal('300.00000000'))).toBe('300');
  expect(toDecimalString(decimal('0.47000000'))).toBe('0.47');
});

it('SHOULD map an income with the status and ids of its linked row', () => {
  const income = IncomeMapper.toIncome({
    amount_per_unit: decimal('0.28'),
    asset: { asset_class: 'BR_STOCK' },
    asset_id: 'asset-1',
    created_at: new Date('2026-10-30T00:00:00Z'),
    created_by: 'user-1',
    currency: 'BRL',
    ex_date: new Date('2026-09-10T00:00:00Z'),
    id: 'inc-1',
    net_amount: 7140,
    notes: null,
    payment_date: new Date('2026-10-30T00:00:00Z'),
    quantity: decimal('300'),
    suggestion_id: null,
    transaction: { account_id: 'acc-1', category_id: 'cat-1', paid: true },
    transaction_id: 'tx-1',
    type: 'JCP',
    updated_at: new Date('2026-10-30T00:00:00Z'),
  });

  expect(income).toMatchObject({
    accountId: 'acc-1',
    amountPerUnit: '0.28',
    categoryId: 'cat-1',
    exDate: '2026-09-10',
    paid: true,
    paymentDate: '2026-10-30',
    quantity: '300',
    type: 'JCP',
  });
});

it('SHOULD map an income whose finance row is gone as planned without account', () => {
  const income = IncomeMapper.toIncome({
    amount_per_unit: null,
    asset: { asset_class: 'BR_REIT' },
    asset_id: 'asset-1',
    created_at: new Date(),
    created_by: 'user-1',
    currency: 'BRL',
    ex_date: null,
    id: 'inc-1',
    net_amount: 100,
    notes: null,
    payment_date: new Date('2026-10-30T00:00:00Z'),
    quantity: null,
    suggestion_id: 'sug-1',
    transaction: null,
    transaction_id: null,
    type: 'YIELD',
    updated_at: new Date(),
  });

  expect(income).toMatchObject({ accountId: null, categoryId: null, exDate: null, paid: false });
});

it('SHOULD map a category with its scopes AND a suggestion with its event', () => {
  expect(
    IncomeMapper.toCategory({
      all_scopes: true,
      scopes: [{ owner: 'FAMILY', owner_id: 'fam-1' }],
      status: 'ARCHIVED',
      system_key: null,
      type: 'INCOME',
    } as never),
  ).toMatchObject({
    allScopes: true,
    archived: true,
    isIncome: true,
    isSystem: false,
    owner: null,
    scopes: [{ owner: 'FAMILY', ownerId: 'fam-1' }],
  });

  const suggestion = IncomeMapper.toSuggestion({
    asset_id: 'asset-1',
    event: {
      amount_per_unit: decimal('0.47'),
      currency: 'BRL',
      ex_date: new Date('2026-11-21T00:00:00Z'),
      id: 'ev-1',
      market: 'B3',
      payment_date: null,
      source: 'brapi',
      ticker: 'PETR4',
      type: 'DIVIDEND',
    },
    event_id: 'ev-1',
    id: 'sug-1',
    quantity: decimal('300'),
    status: 'PENDING',
  } as never);

  expect(suggestion).toMatchObject({
    event: { amountPerUnit: '0.47', exDate: '2026-11-21', paymentDate: null },
    quantity: '300',
    status: 'PENDING',
  });
});
