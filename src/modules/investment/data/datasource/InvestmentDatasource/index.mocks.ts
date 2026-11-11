import { Test } from '@nestjs/testing';

import { Prisma } from '@db/client';
import { Database } from '@shared/infra/db/Database';

import { InvestmentDatasource } from './index';

// region Spies

const spies = {
  accountFindUnique: jest.fn(),
  accountUpdate: jest.fn(),
  adjustmentDeleteMany: jest.fn(),
  adjustmentFindMany: jest.fn(),
  adjustmentFindUnique: jest.fn(),
  adjustmentUpsert: jest.fn(),
  assetCreate: jest.fn(),
  assetDeleteMany: jest.fn(),
  assetFindFirst: jest.fn(),
  assetFindMany: jest.fn(),
  assetFindUnique: jest.fn(),
  assetUpdate: jest.fn(),
  incomeFindMany: jest.fn(),
  operationCreate: jest.fn(),
  operationDelete: jest.fn(),
  operationFindMany: jest.fn(),
  operationFindUnique: jest.fn(),
  operationUpdate: jest.fn(),
  queryRaw: jest.fn(),
  rateCreate: jest.fn(),
  rateDeleteMany: jest.fn(),
  rateFindMany: jest.fn(),
  rateFindUnique: jest.fn(),
  rateUpdate: jest.fn(),
  suggestionDelete: jest.fn(),
  suggestionFindMany: jest.fn(),
  suggestionUpdate: jest.fn(),
  termsFindMany: jest.fn(),
  termsFindUnique: jest.fn(),
  termsUpsert: jest.fn(),
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
  investmentFixedIncomeAdjustment: {
    deleteMany: spies.adjustmentDeleteMany,
    findMany: spies.adjustmentFindMany,
    findUnique: spies.adjustmentFindUnique,
    upsert: spies.adjustmentUpsert,
  },
  investmentFixedIncomeRate: {
    create: spies.rateCreate,
    deleteMany: spies.rateDeleteMany,
    findMany: spies.rateFindMany,
    findUnique: spies.rateFindUnique,
    update: spies.rateUpdate,
  },
  investmentFixedIncomeTerms: {
    findMany: spies.termsFindMany,
    findUnique: spies.termsFindUnique,
    upsert: spies.termsUpsert,
  },
  investmentIncome: { findMany: spies.incomeFindMany },
  investmentIncomeSuggestion: {
    delete: spies.suggestionDelete,
    findMany: spies.suggestionFindMany,
    update: spies.suggestionUpdate,
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
  spies.incomeFindMany.mockResolvedValue([]);
  spies.suggestionFindMany.mockResolvedValue([]);

  const module = await Test.createTestingModule({
    providers: [InvestmentDatasource, { provide: Database, useValue: databaseMock }],
  }).compile();

  setup = module.get(InvestmentDatasource);
});

export { spies };
