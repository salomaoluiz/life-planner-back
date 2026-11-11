import { Test } from '@nestjs/testing';

import { Prisma } from '@db/client';
import { InvestmentIncomeType } from '@investment/domain/enum';
import { Database } from '@shared/infra/db/Database';

import { IncomeDatasource } from './index';

const spies = {
  accountFindUnique: jest.fn(),
  accountUpdate: jest.fn(),
  assetFindMany: jest.fn(),
  categoryFindUnique: jest.fn(),
  eventFindMany: jest.fn(),
  eventUpsert: jest.fn(),
  incomeAggregate: jest.fn(),
  incomeCreate: jest.fn(),
  incomeDelete: jest.fn(),
  incomeFindFirst: jest.fn(),
  incomeFindMany: jest.fn(),
  incomeFindUnique: jest.fn(),
  incomeUpdate: jest.fn(),
  operationFindFirst: jest.fn(),
  queryRaw: jest.fn(),
  suggestionCount: jest.fn(),
  suggestionCreateMany: jest.fn(),
  suggestionFindMany: jest.fn(),
  suggestionFindUnique: jest.fn(),
  suggestionUpdate: jest.fn(),
  transactionCreate: jest.fn(),
  transactionDelete: jest.fn(),
  transactionUpdate: jest.fn(),
};

const tx = {
  $queryRaw: spies.queryRaw,
  financialAccount: { findUnique: spies.accountFindUnique, update: spies.accountUpdate },
  financialCategory: { findUnique: spies.categoryFindUnique },
  financialTransaction: {
    create: spies.transactionCreate,
    delete: spies.transactionDelete,
    update: spies.transactionUpdate,
  },
  investmentAsset: { findMany: spies.assetFindMany },
  investmentIncome: {
    aggregate: spies.incomeAggregate,
    create: spies.incomeCreate,
    delete: spies.incomeDelete,
    findFirst: spies.incomeFindFirst,
    findMany: spies.incomeFindMany,
    findUnique: spies.incomeFindUnique,
    update: spies.incomeUpdate,
  },
  investmentIncomeEvent: { findMany: spies.eventFindMany, upsert: spies.eventUpsert },
  investmentIncomeSuggestion: {
    count: spies.suggestionCount,
    createMany: spies.suggestionCreateMany,
    findMany: spies.suggestionFindMany,
    findUnique: spies.suggestionFindUnique,
    update: spies.suggestionUpdate,
  },
  investmentOperation: { findFirst: spies.operationFindFirst },
};

const databaseMock = {
  client: { ...tx, $transaction: (fn: (client: unknown) => unknown) => fn(tx) },
} as unknown as Database;

export const mocks = {
  decimal: (value: string) => new Prisma.Decimal(value),
  params: {
    accountId: 'acc-1',
    amountPerUnit: '0.28',
    assetId: 'asset-1',
    assetLabel: 'PETR4',
    categoryId: 'cat-1',
    createdBy: 'user-1',
    currency: 'BRL',
    exDate: '2026-09-10',
    netAmount: 7140,
    notes: null,
    paid: true,
    paymentDate: '2026-10-30',
    quantity: '300',
    type: InvestmentIncomeType.JCP,
  },
};

export let setup: IncomeDatasource;

beforeEach(async () => {
  jest.resetAllMocks();

  const module = await Test.createTestingModule({
    providers: [IncomeDatasource, { provide: Database, useValue: databaseMock }],
  }).compile();

  setup = module.get(IncomeDatasource);
});

export { spies };
