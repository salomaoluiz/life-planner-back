import { Test } from '@nestjs/testing';

import { Database } from '@shared/infra/db/Database';

import { CorporateEventDatasource } from './index';

export const spies = {
  assetFindMany: jest.fn(),
  eventFindMany: jest.fn(),
  eventUpsert: jest.fn(),
  queryRaw: jest.fn(),
  suggestionCreateMany: jest.fn(),
  suggestionFindMany: jest.fn(),
  suggestionFindUnique: jest.fn(),
  suggestionGroupBy: jest.fn(),
  suggestionUpdate: jest.fn(),
};

const tx = {
  $queryRaw: spies.queryRaw,
  investmentAsset: { findMany: spies.assetFindMany },
  investmentCorporateEvent: { findMany: spies.eventFindMany, upsert: spies.eventUpsert },
  investmentEventSuggestion: {
    createMany: spies.suggestionCreateMany,
    findMany: spies.suggestionFindMany,
    findUnique: spies.suggestionFindUnique,
    groupBy: spies.suggestionGroupBy,
    update: spies.suggestionUpdate,
  },
};
const databaseMock = {
  client: { ...tx, $transaction: (fn: (client: unknown) => unknown) => fn(tx) },
} as unknown as Database;

export let setup: CorporateEventDatasource;

beforeEach(async () => {
  jest.resetAllMocks();

  const module = await Test.createTestingModule({
    providers: [CorporateEventDatasource, { provide: Database, useValue: databaseMock }],
  }).compile();

  setup = module.get(CorporateEventDatasource);
});
