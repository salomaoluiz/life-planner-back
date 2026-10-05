import { faker } from '@faker-js/faker';
import { Test } from '@nestjs/testing';

import { StockItem } from '@db/client';
import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';
import { Database } from '@shared/infra/db/Database';

import { StockDatasource } from './index';

// region Mocks

const stockMock: StockItem = {
  barcode: null,
  brand: null,
  created_at: faker.date.past(),
  description: 'Rice',
  expiration_date: null,
  id: faker.string.uuid(),
  notes: null,
  opening_date: null,
  owner: 'USER',
  owner_id: faker.string.uuid(),
  purchase_date: null,
  quantity: 2,
  unit: 'kilogram',
  updated_at: faker.date.recent(),
};

const ownersMock = [
  { owner: OwnerType.USER, ownerId: stockMock.owner_id },
  { owner: OwnerType.FAMILY, ownerId: faker.string.uuid() },
];

// endregion Mocks

// region Spies

const createSpy = jest.fn();
const deleteManySpy = jest.fn();
const findFirstSpy = jest.fn();
const findManySpy = jest.fn();
const findUniqueSpy = jest.fn();
const updateSpy = jest.fn();

// endregion Spies

const databaseMock = {
  client: {
    stockItem: {
      create: createSpy,
      deleteMany: deleteManySpy,
      findFirst: findFirstSpy,
      findMany: findManySpy,
      findUnique: findUniqueSpy,
      update: updateSpy,
    },
  },
} as unknown as Database;

let setup: StockDatasource;

beforeEach(async () => {
  jest.clearAllMocks();

  const module = await Test.createTestingModule({
    providers: [StockDatasource, { provide: Database, useValue: databaseMock }],
  }).compile();

  setup = module.get<StockDatasource>(StockDatasource);
});

const mocks = { owners: ownersMock, stock: stockMock };
const spies = {
  create: createSpy,
  deleteMany: deleteManySpy,
  findFirst: findFirstSpy,
  findMany: findManySpy,
  findUnique: findUniqueSpy,
  update: updateSpy,
};

export { mocks, setup, spies };
