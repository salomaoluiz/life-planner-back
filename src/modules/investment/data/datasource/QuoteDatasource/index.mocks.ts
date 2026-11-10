import { Test } from '@nestjs/testing';

import { Prisma } from '@db/client';
import { Database } from '@shared/infra/db/Database';

import { QuoteDatasource } from './index';

// region Spies

const spies = {
  fxFindUnique: jest.fn(),
  fxHistoryFindFirst: jest.fn(),
  fxHistoryFindMany: jest.fn(),
  fxHistoryUpsert: jest.fn(),
  fxUpsert: jest.fn(),
  historyFindFirst: jest.fn(),
  historyFindMany: jest.fn(),
  historyUpsert: jest.fn(),
  queryRaw: jest.fn(),
  quoteFindMany: jest.fn(),
  quoteUpdateMany: jest.fn(),
  quoteUpsert: jest.fn(),
};

// endregion Spies

const tx = {
  $queryRaw: spies.queryRaw,
  fxRate: { findUnique: spies.fxFindUnique, upsert: spies.fxUpsert },
  fxRateHistory: {
    findFirst: spies.fxHistoryFindFirst,
    findMany: spies.fxHistoryFindMany,
    upsert: spies.fxHistoryUpsert,
  },
  investmentPriceHistory: {
    findFirst: spies.historyFindFirst,
    findMany: spies.historyFindMany,
    upsert: spies.historyUpsert,
  },
  investmentQuote: {
    findMany: spies.quoteFindMany,
    updateMany: spies.quoteUpdateMany,
    upsert: spies.quoteUpsert,
  },
};

const databaseMock = {
  client: {
    ...tx,
    $transaction: (arg: unknown) =>
      typeof arg === 'function' ? arg(tx) : Promise.all(arg as Promise<unknown>[]),
  },
} as unknown as Database;

export const mocks = {
  decimal: (value: string) => new Prisma.Decimal(value),
  upsert: {
    change_percent: '0.48',
    currency: 'BRL',
    day_high: '10.6',
    day_low: '10.4',
    logo_url: null,
    market: 'B3',
    name: 'Itausa PN',
    previous_close: '10.48',
    price: '10.53',
    quoted_at: new Date('2026-11-04T16:00:00Z'),
    source: 'BRAPI',
    ticker: 'ITSA4',
  },
};

export let setup: QuoteDatasource;

beforeEach(async () => {
  jest.resetAllMocks();

  const module = await Test.createTestingModule({
    providers: [QuoteDatasource, { provide: Database, useValue: databaseMock }],
  }).compile();

  setup = module.get(QuoteDatasource);
});

export { spies };
