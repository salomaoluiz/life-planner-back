import { Test } from '@nestjs/testing';

import { Database } from '@shared/infra/db/Database';

import { StockCatalogDatasource } from './index';

const spies = {
  categoryCreate: jest.fn(),
  categoryDeleteMany: jest.fn(),
  categoryFindMany: jest.fn(),
  categoryFindUnique: jest.fn(),
  categoryUpdate: jest.fn(),
  categoryUpdateMany: jest.fn(),
  itemGroupBy: jest.fn(),
  locationCreate: jest.fn(),
  locationDeleteMany: jest.fn(),
  locationFindMany: jest.fn(),
  locationFindUnique: jest.fn(),
  locationUpdate: jest.fn(),
  shoppingListFindMany: jest.fn(),
  transaction: jest.fn(),
};
const databaseMock = {
  client: {
    $transaction: spies.transaction,
    stockCategory: {
      create: spies.categoryCreate,
      deleteMany: spies.categoryDeleteMany,
      findMany: spies.categoryFindMany,
      findUnique: spies.categoryFindUnique,
      update: spies.categoryUpdate,
      updateMany: spies.categoryUpdateMany,
    },
    stockItem: { groupBy: spies.itemGroupBy },
    stockLocation: {
      create: spies.locationCreate,
      deleteMany: spies.locationDeleteMany,
      findMany: spies.locationFindMany,
      findUnique: spies.locationFindUnique,
      update: spies.locationUpdate,
    },
    stockShoppingList: { findMany: spies.shoppingListFindMany },
  },
} as unknown as Database;
let setup: StockCatalogDatasource;

beforeEach(async () => {
  jest.clearAllMocks();
  spies.transaction.mockImplementation(async (operation: unknown) =>
    Array.isArray(operation)
      ? Promise.all(operation)
      : (operation as (tx: unknown) => Promise<unknown>)(databaseMock.client),
  );

  const module = await Test.createTestingModule({
    providers: [StockCatalogDatasource, { provide: Database, useValue: databaseMock }],
  }).compile();

  setup = module.get(StockCatalogDatasource);
});

const mocks = { key: { owner: 'USER' as const, owner_id: 'user' } };

export { mocks, setup, spies };
