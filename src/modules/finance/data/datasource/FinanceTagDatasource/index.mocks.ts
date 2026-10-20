import { faker } from '@faker-js/faker';
import { Test } from '@nestjs/testing';

import { FinancialTagWithScopes } from '@finance/data/datasource/mapper/FinanceTagMapper';
import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';
import { Database } from '@shared/infra/db/Database';

import { FinanceTagDatasource } from './index';

// region Mocks

const ownerIdMock = faker.string.uuid();
const tagMock: FinancialTagWithScopes = {
  all_scopes: false,
  created_at: faker.date.past(),
  creator_id: ownerIdMock,
  id: faker.string.uuid(),
  name: 'gasto-fixo',
  owner: 'USER',
  owner_id: ownerIdMock,
  scopes: [],
  updated_at: faker.date.recent(),
};
const ownersMock = [{ owner: OwnerType.USER, ownerId: ownerIdMock }];

// endregion Mocks

// region Spies

const createSpy = jest.fn();
const deleteManySpy = jest.fn();
const findFirstSpy = jest.fn();
const findManySpy = jest.fn();
const findUniqueOrThrowSpy = jest.fn();
const findUniqueSpy = jest.fn();
const groupByRecurrenceSpy = jest.fn();
const groupByTransactionSpy = jest.fn();
const scopeCreateManySpy = jest.fn();
const scopeDeleteManySpy = jest.fn();
const transactionSpy = jest.fn();
const trLinkCreateManySpy = jest.fn();
const trLinkDeleteManySpy = jest.fn();
const trLinkFindManySpy = jest.fn();
const recLinkCreateManySpy = jest.fn();
const recLinkDeleteManySpy = jest.fn();
const recLinkFindManySpy = jest.fn();
const updateSpy = jest.fn();

// endregion Spies

const databaseMock = {
  client: {
    $transaction: transactionSpy,
    financialRecurrenceTag: { groupBy: groupByRecurrenceSpy },
    financialTag: {
      create: createSpy,
      deleteMany: deleteManySpy,
      findFirst: findFirstSpy,
      findMany: findManySpy,
      findUnique: findUniqueSpy,
    },
    financialTagScope: { createMany: scopeCreateManySpy, deleteMany: scopeDeleteManySpy },
    financialTransactionTag: { groupBy: groupByTransactionSpy },
  },
} as unknown as Database;

// Interactive transactions run their callback against this fake client.
const txClient = {
  financialRecurrenceTag: {
    createMany: recLinkCreateManySpy,
    deleteMany: recLinkDeleteManySpy,
    findMany: recLinkFindManySpy,
  },
  financialTag: {
    create: createSpy,
    findMany: findManySpy,
    findUniqueOrThrow: findUniqueOrThrowSpy,
    update: updateSpy,
  },
  financialTagScope: { createMany: scopeCreateManySpy, deleteMany: scopeDeleteManySpy },
  financialTransactionTag: {
    createMany: trLinkCreateManySpy,
    deleteMany: trLinkDeleteManySpy,
    findMany: trLinkFindManySpy,
  },
};

let setup: FinanceTagDatasource;

beforeEach(async () => {
  jest.clearAllMocks();
  transactionSpy.mockImplementation(async (arg: unknown) =>
    typeof arg === 'function' ? arg(txClient) : arg,
  );

  const module = await Test.createTestingModule({
    providers: [FinanceTagDatasource, { provide: Database, useValue: databaseMock }],
  }).compile();

  setup = module.get<FinanceTagDatasource>(FinanceTagDatasource);
});

const mocks = { ownerId: ownerIdMock, owners: ownersMock, tag: tagMock };
const spies = {
  create: createSpy,
  deleteMany: deleteManySpy,
  findFirst: findFirstSpy,
  findMany: findManySpy,
  findUnique: findUniqueSpy,
  findUniqueOrThrow: findUniqueOrThrowSpy,
  groupByRecurrence: groupByRecurrenceSpy,
  groupByTransaction: groupByTransactionSpy,
  recLinkCreateMany: recLinkCreateManySpy,
  recLinkDeleteMany: recLinkDeleteManySpy,
  recLinkFindMany: recLinkFindManySpy,
  scopeCreateMany: scopeCreateManySpy,
  scopeDeleteMany: scopeDeleteManySpy,
  trLinkCreateMany: trLinkCreateManySpy,
  trLinkDeleteMany: trLinkDeleteManySpy,
  trLinkFindMany: trLinkFindManySpy,
  update: updateSpy,
};

export { mocks, setup, spies };
