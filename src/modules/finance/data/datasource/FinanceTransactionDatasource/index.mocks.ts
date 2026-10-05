import { faker } from '@faker-js/faker';
import { Test } from '@nestjs/testing';

import { FinancialTransactionWithRelations } from '@finance/data/repository/datasource/IFinanceTransactionDatasource';
import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';
import { Database } from '@shared/infra/db/Database';

import { FinanceTransactionDatasource } from './index';

// region Mocks

const transactionMock: FinancialTransactionWithRelations = {
  account: { icon: 'bank', id: faker.string.uuid(), name: 'Checking' },
  account_id: faker.string.uuid(),
  category: { icon: 'cart', icon_color: '#2E7D32', id: faker.string.uuid(), name: 'Groceries' },
  category_id: faker.string.uuid(),
  created_at: faker.date.past(),
  date: new Date('2026-10-03T00:00:00.000Z'),
  description: 'Weekly groceries',
  id: faker.string.uuid(),
  owner: 'USER',
  owner_id: faker.string.uuid(),
  type: 'EXPENSE',
  updated_at: faker.date.recent(),
  value: 23490,
};
const ownersMock = [{ owner: OwnerType.USER, ownerId: transactionMock.owner_id }];
const includeMock = {
  account: { select: { icon: true, id: true, name: true } },
  category: { select: { icon: true, icon_color: true, id: true, name: true } },
};

// endregion Mocks

// region Spies

const countSpy = jest.fn();
const createSpy = jest.fn();
const deleteManySpy = jest.fn();
const findFirstSpy = jest.fn();
const findManySpy = jest.fn();
const findUniqueSpy = jest.fn();
const updateSpy = jest.fn();

// endregion Spies

const databaseMock = {
  client: {
    financialTransaction: {
      count: countSpy,
      create: createSpy,
      deleteMany: deleteManySpy,
      findFirst: findFirstSpy,
      findMany: findManySpy,
      findUnique: findUniqueSpy,
      update: updateSpy,
    },
  },
} as unknown as Database;

let setup: FinanceTransactionDatasource;

beforeEach(async () => {
  jest.clearAllMocks();

  const module = await Test.createTestingModule({
    providers: [FinanceTransactionDatasource, { provide: Database, useValue: databaseMock }],
  }).compile();

  setup = module.get<FinanceTransactionDatasource>(FinanceTransactionDatasource);
});

const mocks = { include: includeMock, owners: ownersMock, transaction: transactionMock };
const spies = {
  count: countSpy,
  create: createSpy,
  deleteMany: deleteManySpy,
  findFirst: findFirstSpy,
  findMany: findManySpy,
  findUnique: findUniqueSpy,
  update: updateSpy,
};

export { mocks, setup, spies };
