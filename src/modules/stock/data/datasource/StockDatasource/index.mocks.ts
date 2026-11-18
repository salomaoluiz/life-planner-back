import { faker } from '@faker-js/faker';
import { Test } from '@nestjs/testing';

import { StockItem, StockLot, StockMovement } from '@db/client';
import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';
import { Database } from '@shared/infra/db/Database';

import { StockDatasource } from './index';

const stockMock = {
  id: faker.string.uuid(),
  owner: 'USER',
  owner_id: faker.string.uuid(),
  unit: 'kilogram',
} as unknown as StockItem;
const lotMock = { id: 'lot', item_id: stockMock.id, quantity: 2 } as unknown as StockLot;
const movementMock = { id: 'mov' } as unknown as StockMovement;
const ownersMock = [
  { owner: OwnerType.USER, ownerId: stockMock.owner_id },
  { owner: OwnerType.FAMILY, ownerId: faker.string.uuid() },
];

const spies = {
  lotCreate: jest.fn(),
  lotDeleteMany: jest.fn(),
  lotFindMany: jest.fn(),
  lotUpdate: jest.fn(),
  movementCreate: jest.fn(),
  movementDeleteMany: jest.fn(),
  movementFindFirst: jest.fn(),
  movementFindMany: jest.fn(),
  queryRaw: jest.fn(),
  stockCreate: jest.fn(),
  stockDeleteMany: jest.fn(),
  stockFindFirst: jest.fn(),
  stockFindMany: jest.fn(),
  stockFindUnique: jest.fn(),
  stockFindUniqueOrThrow: jest.fn(),
  stockUpdate: jest.fn(),
};

const client = {
  $queryRaw: spies.queryRaw,
  $transaction: jest.fn(),
  stockItem: {
    create: spies.stockCreate,
    deleteMany: spies.stockDeleteMany,
    findFirst: spies.stockFindFirst,
    findMany: spies.stockFindMany,
    findUnique: spies.stockFindUnique,
    findUniqueOrThrow: spies.stockFindUniqueOrThrow,
    update: spies.stockUpdate,
  },
  stockLot: {
    create: spies.lotCreate,
    deleteMany: spies.lotDeleteMany,
    findMany: spies.lotFindMany,
    update: spies.lotUpdate,
  },
  stockMovement: {
    create: spies.movementCreate,
    deleteMany: spies.movementDeleteMany,
    findFirst: spies.movementFindFirst,
    findMany: spies.movementFindMany,
  },
};
// A transaction runs the callback against the same client.
client.$transaction.mockImplementation(async (callback: (tx: unknown) => unknown) =>
  callback(client),
);

const databaseMock = { client } as unknown as Database;
let setup: StockDatasource;

beforeEach(async () => {
  jest.clearAllMocks();
  client.$transaction.mockImplementation(async (callback: (tx: unknown) => unknown) =>
    callback(client),
  );

  const module = await Test.createTestingModule({
    providers: [StockDatasource, { provide: Database, useValue: databaseMock }],
  }).compile();

  setup = module.get<StockDatasource>(StockDatasource);
});

const mocks = { lot: lotMock, movement: movementMock, owners: ownersMock, stock: stockMock };

export { mocks, setup, spies };
