import { Test } from '@nestjs/testing';

import { UserSession } from '@db/client';
import { Database } from '@shared/infra/db/Database';

import { UserSessionDatasource } from './index';

// region Mocks

const date = new Date('2026-10-15T12:00:00.000Z');

const sessionMock: UserSession = {
  created_at: date,
  device_name: 'iPhone',
  id: 'session-id',
  last_used_at: date,
  previous_token_hash: 'prev',
  retired_token_hash: null,
  rotated_at: date,
  token_hash: 'cur',
  user_id: 'user-id',
};

// endregion Mocks

// region Spies

const createSpy = jest.fn();
const deleteManySpy = jest.fn();
const findFirstSpy = jest.fn();
const updateManySpy = jest.fn();

// endregion Spies

const databaseMock = {
  client: {
    userSession: {
      create: createSpy,
      deleteMany: deleteManySpy,
      findFirst: findFirstSpy,
      updateMany: updateManySpy,
    },
  },
} as unknown as Database;

let setup: UserSessionDatasource;

beforeEach(async () => {
  jest.clearAllMocks();

  const module = await Test.createTestingModule({
    providers: [UserSessionDatasource, { provide: Database, useValue: databaseMock }],
  }).compile();

  setup = module.get<UserSessionDatasource>(UserSessionDatasource);
});

const mocks = { session: sessionMock };

const spies = {
  create: createSpy,
  deleteMany: deleteManySpy,
  findFirst: findFirstSpy,
  updateMany: updateManySpy,
};

export { mocks, setup, spies };
