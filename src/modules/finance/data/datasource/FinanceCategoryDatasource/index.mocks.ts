import { faker } from '@faker-js/faker';
import { Test } from '@nestjs/testing';

import { FinancialCategory } from '@db/client';
import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';
import { Database } from '@shared/infra/db/Database';

import { FinanceCategoryDatasource } from './index';

// region Mocks

const ownerIdMock = faker.string.uuid();
const categoryMock: FinancialCategory = {
  created_at: faker.date.past(),
  depth_level: 0,
  exclude_from_totals: false,
  icon: 'cart',
  icon_color: '#2E7D32',
  id: faker.string.uuid(),
  name: 'Groceries',
  owner: 'USER',
  owner_id: ownerIdMock,
  parent_id: null,
  system_key: null,
  type: 'EXPENSE',
  updated_at: faker.date.recent(),
};
const ownersMock = [{ owner: OwnerType.USER, ownerId: ownerIdMock }];

// endregion Mocks

// region Spies

const createSpy = jest.fn();
const deleteManySpy = jest.fn();
const findFirstSpy = jest.fn();
const findManySpy = jest.fn();
const findUniqueSpy = jest.fn();
const transactionSpy = jest.fn();
const updateSpy = jest.fn();

// endregion Spies

const databaseMock = {
  client: {
    $transaction: transactionSpy,
    financialCategory: {
      create: createSpy,
      deleteMany: deleteManySpy,
      findFirst: findFirstSpy,
      findMany: findManySpy,
      findUnique: findUniqueSpy,
      update: updateSpy,
    },
  },
} as unknown as Database;

let setup: FinanceCategoryDatasource;

beforeEach(async () => {
  jest.clearAllMocks();

  const module = await Test.createTestingModule({
    providers: [FinanceCategoryDatasource, { provide: Database, useValue: databaseMock }],
  }).compile();

  setup = module.get<FinanceCategoryDatasource>(FinanceCategoryDatasource);
});

const mocks = { category: categoryMock, ownerId: ownerIdMock, owners: ownersMock };
const spies = {
  create: createSpy,
  deleteMany: deleteManySpy,
  findFirst: findFirstSpy,
  findMany: findManySpy,
  findUnique: findUniqueSpy,
  transaction: transactionSpy,
  update: updateSpy,
};

export { mocks, setup, spies };
