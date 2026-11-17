import { Test } from '@nestjs/testing';

import { Database } from '@shared/infra/db/Database';

import { StockSuggestionDatasource } from './index';

const spies = { executeRaw: jest.fn(), queryRaw: jest.fn(), transaction: jest.fn() };
const client = {
  $executeRaw: spies.executeRaw,
  $queryRaw: spies.queryRaw,
  $transaction: spies.transaction,
};
const databaseMock = { client } as unknown as Database;
let setup: StockSuggestionDatasource;

beforeEach(async () => {
  jest.clearAllMocks();
  spies.queryRaw.mockResolvedValue([]);
  spies.transaction.mockImplementation(async (callback: (tx: unknown) => unknown) =>
    callback(client),
  );

  const module = await Test.createTestingModule({
    providers: [StockSuggestionDatasource, { provide: Database, useValue: databaseMock }],
  }).compile();

  setup = module.get(StockSuggestionDatasource);
});

const params = {
  limit: 8,
  max_distance: 0.25,
  min_trigram: 0.3,
  owner: 'USER' as const,
  owner_id: 'user',
  query: 'musarela',
};
function sqlOf(call: unknown[]) {
  return ((call[0] as { sql?: string; strings?: string[] }).sql ?? '') as string;
}

export { params, setup, spies, sqlOf };
