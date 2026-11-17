import { Test } from '@nestjs/testing';

import { Database } from '@shared/infra/db/Database';

import { MarketIndexDatasource } from './index';

const spies = {
  assetFindMany: jest.fn(),
  executeRaw: jest.fn(),
  fetchFindMany: jest.fn(),
  fetchUpsert: jest.fn(),
  fxFindMany: jest.fn(),
  rateFindMany: jest.fn(),
  transaction: jest.fn(),
  valueAggregate: jest.fn(),
  valueFindFirst: jest.fn(),
  valueFindMany: jest.fn(),
  valueGroupBy: jest.fn(),
};

const databaseMock = {
  client: {
    $executeRaw: spies.executeRaw,
    $transaction: spies.transaction,
    fxRate: { findMany: spies.fxFindMany },
    investmentAsset: { findMany: spies.assetFindMany },
    investmentFixedIncomeRate: { findMany: spies.rateFindMany },
    marketIndexFetch: { findMany: spies.fetchFindMany, upsert: spies.fetchUpsert },
    marketIndexValue: {
      aggregate: spies.valueAggregate,
      findFirst: spies.valueFindFirst,
      findMany: spies.valueFindMany,
      groupBy: spies.valueGroupBy,
    },
  },
};

async function setup(): Promise<MarketIndexDatasource> {
  const module = await Test.createTestingModule({
    providers: [MarketIndexDatasource, { provide: Database, useValue: databaseMock }],
  }).compile();

  return module.get(MarketIndexDatasource);
}

export { setup, spies };
