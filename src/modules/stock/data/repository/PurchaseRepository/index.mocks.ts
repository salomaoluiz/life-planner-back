import { Test } from '@nestjs/testing';

import { Database } from '@shared/infra/db/Database';

import { PurchaseRepository } from './index';

jest.mock('@stock/data/datasource/RestockSync', () => ({ syncRestockRows: jest.fn() }));

type Fn = jest.Mock;

// Every model method of the transaction client is an auto-created jest mock.
function model(): Record<string, Fn> {
  const cache: Record<string, Fn> = {};

  return new Proxy(cache, {
    get: (target, key: string) => (target[key] ??= jest.fn()),
  });
}
const models = {
  financialSplit: model(),
  financialTransaction: model(),
  stockItem: model(),
  stockLot: model(),
  stockMovement: model(),
  stockPriceHistory: model(),
  stockPurchase: model(),
  stockPurchaseEvent: model(),
  stockPurchaseRow: model(),
  stockShoppingListRow: model(),
};
const raws = { $executeRaw: jest.fn(), $queryRaw: jest.fn() };
const client: Record<string, unknown> = { ...models, ...raws };

client.$transaction = jest.fn(async (callback: (tx: unknown) => Promise<unknown>) =>
  callback(client),
);
const databaseMock = {
  client,
  runInTransaction: jest.fn(async (work: () => Promise<unknown>) => work()),
};
function day(value: string) {
  return new Date(`${value}T00:00:00.000Z`);
}
const at = new Date('2026-11-18T10:00:00.000Z');

function rawPurchase(extra: Record<string, unknown> = {}) {
  return {
    account_id: null,
    closed_at: null,
    closed_by: null,
    closing_at: null,
    closing_by: null,
    created_at: at,
    credit_card_id: null,
    currency: 'BRL',
    ended_at: null,
    id: 'p1',
    invoice_month: null,
    last_activity_at: at,
    list_id: 'list-id',
    market_id: 'market-id',
    owner: 'USER',
    owner_id: 'user-id',
    purchase_date: day('2026-11-18'),
    receipt_total_cents: null,
    split_id: null,
    started_at: at,
    started_by: 'user-id',
    status: 'OPEN',
    transaction_id: null,
    updated_at: at,
    ...extra,
  };
}
function rawRow(extra: Record<string, unknown> = {}) {
  return {
    checked_at: at,
    checked_by: 'user-id',
    checker: { id: 'user-id', name: 'Ana' },
    description: 'Candle',
    entry_movement_id: null,
    expiration_date: null,
    id: 'r1',
    item: null,
    item_id: null,
    line_total_cents: null,
    list_row_id: null,
    price_input: null,
    purchase_id: 'p1',
    quantity: 2,
    state: 'IN_CART',
    unit: 'unit',
    unit_price_cents: null,
    unknown_price: false,
    ...extra,
  };
}
let setup: PurchaseRepository;

beforeEach(async () => {
  jest.clearAllMocks();
  raws.$queryRaw.mockResolvedValue([{ id: 'p1' }]);
  raws.$executeRaw.mockResolvedValue(1);
  models.stockPurchase.findUnique.mockResolvedValue(rawPurchase());
  models.stockPurchase.update.mockImplementation(async ({ data }: { data: object }) =>
    rawPurchase(data as Record<string, unknown>),
  );

  const module = await Test.createTestingModule({
    providers: [PurchaseRepository, { provide: Database, useValue: databaseMock }],
  }).compile();

  setup = module.get(PurchaseRepository);
});

export { at, client, databaseMock, day, models, rawPurchase, rawRow, raws, setup };
