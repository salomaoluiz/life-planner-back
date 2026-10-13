import { faker } from '@faker-js/faker';
import { Test } from '@nestjs/testing';

import { FamilyMember } from '@db/client';
import { Database } from '@shared/infra/db/Database';

import { FamilyMemberDatasource } from './index';

// region Mocks

const memberMock: FamilyMember = {
  created_at: faker.date.past(),
  email: 'test@example.com',
  family_id: faker.string.uuid(),
  id: faker.string.uuid(),
  invite_expires_at: faker.date.soon({ days: 7 }),
  invite_token: 'token-hash',
  joined_at: null,
  updated_at: faker.date.recent(),
  user_id: null,
};

// endregion Mocks

// region Spies

const createSpy = jest.fn();
const deleteManySpy = jest.fn();
const findFirstSpy = jest.fn();
const findManySpy = jest.fn();
const findUniqueSpy = jest.fn();
const updateManySpy = jest.fn();

// endregion Spies

const databaseMock = {
  client: {
    familyMember: {
      create: createSpy,
      deleteMany: deleteManySpy,
      findFirst: findFirstSpy,
      findMany: findManySpy,
      findUnique: findUniqueSpy,
      updateMany: updateManySpy,
    },
  },
} as unknown as Database;

let setup: FamilyMemberDatasource;

beforeEach(async () => {
  jest.clearAllMocks();

  const module = await Test.createTestingModule({
    providers: [FamilyMemberDatasource, { provide: Database, useValue: databaseMock }],
  }).compile();

  setup = module.get<FamilyMemberDatasource>(FamilyMemberDatasource);
});

const mocks = {
  member: memberMock,
  userId: faker.string.uuid(),
};

const spies = {
  create: createSpy,
  deleteMany: deleteManySpy,
  findFirst: findFirstSpy,
  findMany: findManySpy,
  findUnique: findUniqueSpy,
  updateMany: updateManySpy,
};

export { mocks, setup, spies };
