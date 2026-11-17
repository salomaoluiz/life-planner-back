import { Test } from '@nestjs/testing';

import { Prisma } from '@db/client';
import { Database } from '@shared/infra/db/Database';

import { IncomeSeriesDatasource } from './index';

const spies = {
  accountFindUnique: jest.fn(),
  accountUpdate: jest.fn(),
  incomeCount: jest.fn(),
  incomeCreateMany: jest.fn(),
  incomeDeleteMany: jest.fn(),
  incomeFindMany: jest.fn(),
  incomeFindUnique: jest.fn(),
  incomeUpdate: jest.fn(),
  queryRaw: jest.fn(),
  seriesCreate: jest.fn(),
  seriesDelete: jest.fn(),
  seriesFindMany: jest.fn(),
  seriesFindUnique: jest.fn(),
  seriesUpdate: jest.fn(),
  transactionCreate: jest.fn(),
  transactionCreateMany: jest.fn(),
  transactionDelete: jest.fn(),
  transactionDeleteMany: jest.fn(),
  transactionUpdate: jest.fn(),
};

const tx = {
  $queryRaw: spies.queryRaw,
  financialAccount: { findUnique: spies.accountFindUnique, update: spies.accountUpdate },
  financialTransaction: {
    create: spies.transactionCreate,
    createMany: spies.transactionCreateMany,
    delete: spies.transactionDelete,
    deleteMany: spies.transactionDeleteMany,
    update: spies.transactionUpdate,
  },
  investmentIncome: {
    count: spies.incomeCount,
    create: jest.fn(),
    createMany: spies.incomeCreateMany,
    deleteMany: spies.incomeDeleteMany,
    findMany: spies.incomeFindMany,
    findUnique: spies.incomeFindUnique,
    update: spies.incomeUpdate,
  },
  investmentIncomeSeries: {
    create: spies.seriesCreate,
    delete: spies.seriesDelete,
    findMany: spies.seriesFindMany,
    findUnique: spies.seriesFindUnique,
    update: spies.seriesUpdate,
  },
};
const databaseMock = {
  client: { ...tx, $transaction: (fn: (client: unknown) => unknown) => fn(tx) },
} as unknown as Database;

export const mocks = {
  occurrences: [
    {
      exDate: '2026-11-07',
      netAmount: 11000,
      number: 1,
      paymentDate: '2026-11-15',
      quantity: '100',
      received: true,
    },
    {
      exDate: '2026-12-07',
      netAmount: 11000,
      number: 2,
      paymentDate: '2026-12-15',
      quantity: '100',
      received: false,
    },
  ],
  seriesRow: {
    account_id: 'acc-1',
    amount_per_unit: new Prisma.Decimal('1.1'),
    asset_id: 'asset-1',
    category_id: 'cat-1',
    created_by: 'user-1',
    currency: 'BRL',
    end_date: null,
    end_reason: null,
    ended_at: null,
    ex_date_offset_days: 8,
    first_number: 1,
    first_payment_date: new Date('2025-01-15T00:00:00Z'),
    frequency_interval: 1,
    frequency_unit: 'MONTH',
    id: 'series-1',
    last_generated_number: 23,
    notes: null,
    type: 'YIELD',
    with_finance: true,
  },
};

export let setup: IncomeSeriesDatasource;

beforeEach(async () => {
  jest.resetAllMocks();
  spies.accountFindUnique.mockResolvedValue({ owner: 'USER', owner_id: 'owner-1' });
  spies.seriesFindUnique.mockResolvedValue(mocks.seriesRow);
  spies.seriesCreate.mockResolvedValue(mocks.seriesRow);
  spies.seriesUpdate.mockResolvedValue(mocks.seriesRow);
  spies.incomeFindMany.mockResolvedValue([]);

  const module = await Test.createTestingModule({
    providers: [IncomeSeriesDatasource, { provide: Database, useValue: databaseMock }],
  }).compile();

  setup = module.get(IncomeSeriesDatasource);
});

export { spies };
