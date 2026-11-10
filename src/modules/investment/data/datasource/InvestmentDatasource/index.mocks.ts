import { Test } from '@nestjs/testing';

import { Prisma } from '@db/client';
import { Database } from '@shared/infra/db/Database';

import { InvestmentDatasource } from './index';

// region Spies

const spies = {
  accountFindUnique: jest.fn(),
  accountUpdate: jest.fn(),
  assetCreate: jest.fn(),
  assetDeleteMany: jest.fn(),
  assetFindFirst: jest.fn(),
  assetFindMany: jest.fn(),
  assetFindUnique: jest.fn(),
  assetUpdate: jest.fn(),
  operationCreate: jest.fn(),
  operationDelete: jest.fn(),
  operationFindMany: jest.fn(),
  operationFindUnique: jest.fn(),
  operationUpdate: jest.fn(),
  queryRaw: jest.fn(),
  transactionCreate: jest.fn(),
  transactionDelete: jest.fn(),
  transactionDeleteMany: jest.fn(),
  transactionUpdate: jest.fn(),
  valuationDeleteMany: jest.fn(),
  valuationFindMany: jest.fn(),
  valuationFindUnique: jest.fn(),
  valuationUpsert: jest.fn(),
};

// endregion Spies

const tx = {
  $queryRaw: spies.queryRaw,
  financialAccount: { findUnique: spies.accountFindUnique, update: spies.accountUpdate },
  financialTransaction: {
    create: spies.transactionCreate,
    delete: spies.transactionDelete,
    deleteMany: spies.transactionDeleteMany,
    update: spies.transactionUpdate,
  },
  investmentAsset: {
    create: spies.assetCreate,
    deleteMany: spies.assetDeleteMany,
    findFirst: spies.assetFindFirst,
    findMany: spies.assetFindMany,
    findUnique: spies.assetFindUnique,
    update: spies.assetUpdate,
  },
  investmentOperation: {
    create: spies.operationCreate,
    delete: spies.operationDelete,
    findMany: spies.operationFindMany,
    findUnique: spies.operationFindUnique,
    update: spies.operationUpdate,
  },
  investmentValuation: {
    deleteMany: spies.valuationDeleteMany,
    findMany: spies.valuationFindMany,
    findUnique: spies.valuationFindUnique,
    upsert: spies.valuationUpsert,
  },
};

const databaseMock = {
  client: { ...tx, $transaction: (fn: (client: unknown) => unknown) => fn(tx) },
} as unknown as Database;

export const mocks = {
  decimal: (value: string) => new Prisma.Decimal(value),
};

export let setup: InvestmentDatasource;

beforeEach(async () => {
  jest.resetAllMocks();

  const module = await Test.createTestingModule({
    providers: [InvestmentDatasource, { provide: Database, useValue: databaseMock }],
  }).compile();

  setup = module.get(InvestmentDatasource);
});

export { spies };
