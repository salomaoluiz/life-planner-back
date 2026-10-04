import { faker } from '@faker-js/faker';
import { Test } from '@nestjs/testing';

import { Family } from '@db/client';
import { Database } from '@shared/infra/db/Database';

import { FamilyDatasource } from './index';

// region Mocks

const familyMock: Family = {
  created_at: faker.date.past(),
  id: faker.string.uuid(),
  name: 'Example Family',
  owner_id: faker.string.uuid(),
  updated_at: faker.date.recent(),
};

// endregion Mocks

// region Spies

const createSpy = jest.fn();
const deleteManySpy = jest.fn();
const findManySpy = jest.fn();
const findUniqueSpy = jest.fn();
const updateSpy = jest.fn();
const memberCountSpy = jest.fn();

// endregion Spies

const databaseMock = {
  client: {
    family: {
      create: createSpy,
      deleteMany: deleteManySpy,
      findMany: findManySpy,
      findUnique: findUniqueSpy,
      update: updateSpy,
    },
    familyMember: { count: memberCountSpy },
  },
} as unknown as Database;

let setup: FamilyDatasource;

beforeEach(async () => {
  jest.clearAllMocks();

  const module = await Test.createTestingModule({
    providers: [FamilyDatasource, { provide: Database, useValue: databaseMock }],
  }).compile();

  setup = module.get<FamilyDatasource>(FamilyDatasource);
});

const mocks = {
  family: familyMock,
  userId: faker.string.uuid(),
};

const spies = {
  create: createSpy,
  deleteMany: deleteManySpy,
  findMany: findManySpy,
  findUnique: findUniqueSpy,
  memberCount: memberCountSpy,
  update: updateSpy,
};

export { mocks, setup, spies };
