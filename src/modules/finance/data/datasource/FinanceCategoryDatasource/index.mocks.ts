import { faker } from '@faker-js/faker';
import { Test } from '@nestjs/testing';

import { FinancialCategoryWithScopes } from '@finance/data/datasource/mapper/FinanceCategoryMapper';
import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';
import { Database } from '@shared/infra/db/Database';

import { FinanceCategoryDatasource } from './index';

// region Mocks

const ownerIdMock = faker.string.uuid();
const categoryMock: FinancialCategoryWithScopes = {
  all_scopes: false,
  created_at: faker.date.past(),
  creator_id: null,
  depth_level: 0,
  exclude_from_totals: false,
  icon: 'cart',
  icon_color: '#2E7D32',
  id: faker.string.uuid(),
  name: 'Groceries',
  owner: 'USER',
  owner_id: ownerIdMock,
  parent_id: null,
  scopes: [],
  system_key: null,
  type: 'EXPENSE',
  updated_at: faker.date.recent(),
};
const ownersMock = [{ owner: OwnerType.USER, ownerId: ownerIdMock }];

// endregion Mocks

// region Spies

const createManyScopeSpy = jest.fn();
const createSpy = jest.fn();
const deleteManyScopeSpy = jest.fn();
const createCategoryTxSpy = jest.fn();
const deleteManySpy = jest.fn();
const findFirstSpy = jest.fn();
const findManySpy = jest.fn();
const findUniqueOrThrowSpy = jest.fn();
const findUniqueSpy = jest.fn();
const recordsUpdateManySpy = jest.fn();
const txCategoryFindManySpy = jest.fn();
const updateManySpy = jest.fn();
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
      findUniqueOrThrow: findUniqueOrThrowSpy,
      update: updateSpy,
      updateMany: updateManySpy,
    },
    financialCategoryScope: { createMany: createManyScopeSpy, deleteMany: deleteManyScopeSpy },
  },
} as unknown as Database;

// Interactive transactions run their callback against this fake client.
const txClient = {
  financialCategory: {
    create: createCategoryTxSpy,
    findMany: txCategoryFindManySpy,
  },
  financialCategoryScope: { createMany: createManyScopeSpy, deleteMany: deleteManyScopeSpy },
  financialInstallmentPlan: { updateMany: recordsUpdateManySpy },
  financialRecurrence: { updateMany: recordsUpdateManySpy },
  financialTransaction: { updateMany: recordsUpdateManySpy },
};

let setup: FinanceCategoryDatasource;

beforeEach(async () => {
  jest.clearAllMocks();
  transactionSpy.mockImplementation(async (arg: unknown) =>
    typeof arg === 'function' ? arg(txClient) : arg,
  );

  const module = await Test.createTestingModule({
    providers: [FinanceCategoryDatasource, { provide: Database, useValue: databaseMock }],
  }).compile();

  setup = module.get<FinanceCategoryDatasource>(FinanceCategoryDatasource);
});

const mocks = { category: categoryMock, ownerId: ownerIdMock, owners: ownersMock };
const spies = {
  create: createSpy,
  createCategoryTx: createCategoryTxSpy,
  createManyScope: createManyScopeSpy,
  deleteMany: deleteManySpy,
  deleteManyScope: deleteManyScopeSpy,
  findFirst: findFirstSpy,
  findMany: findManySpy,
  findUnique: findUniqueSpy,
  findUniqueOrThrow: findUniqueOrThrowSpy,
  recordsUpdateMany: recordsUpdateManySpy,
  transaction: transactionSpy,
  txCategoryFindMany: txCategoryFindManySpy,
  update: updateSpy,
  updateMany: updateManySpy,
};

export { mocks, setup, spies };
