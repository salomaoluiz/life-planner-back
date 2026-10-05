import { faker } from '@faker-js/faker';
import { Test } from '@nestjs/testing';

import { FinancialAccount } from '@db/client';
import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';
import { Database } from '@shared/infra/db/Database';

import { FinanceAccountDatasource } from './index';

// region Mocks

const accountMock: FinancialAccount = {
  balance: 152075,
  created_at: faker.date.past(),
  icon: 'bank',
  id: faker.string.uuid(),
  name: 'Checking',
  owner: 'USER',
  owner_id: faker.string.uuid(),
  status: 'ACTIVE',
  updated_at: faker.date.recent(),
};

const ownersMock = [
  { owner: OwnerType.USER, ownerId: accountMock.owner_id },
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
    financialAccount: {
      create: createSpy,
      deleteMany: deleteManySpy,
      findFirst: findFirstSpy,
      findMany: findManySpy,
      findUnique: findUniqueSpy,
      update: updateSpy,
    },
  },
} as unknown as Database;

let setup: FinanceAccountDatasource;

beforeEach(async () => {
  jest.clearAllMocks();

  const module = await Test.createTestingModule({
    providers: [FinanceAccountDatasource, { provide: Database, useValue: databaseMock }],
  }).compile();

  setup = module.get<FinanceAccountDatasource>(FinanceAccountDatasource);
});

const mocks = { account: accountMock, owners: ownersMock };
const spies = {
  create: createSpy,
  deleteMany: deleteManySpy,
  findFirst: findFirstSpy,
  findMany: findManySpy,
  findUnique: findUniqueSpy,
  update: updateSpy,
};

export { mocks, setup, spies };
