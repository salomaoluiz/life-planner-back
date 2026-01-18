import { Test } from '@nestjs/testing';

import { User } from '@db/client';
import { Database } from '@shared/infra/db/Database';

import { UserDatasource } from './index';

// region Mocks

const userMock: User = {
  created_at: new Date(),
  email: 'test@example.com',
  id: 'user-id-123',
  name: 'Test User',
  password_hash: 'hashed-password',
  photo_url: 'https://example.com/photo.jpg',
  updated_at: new Date(),
};

const emailMock = 'test@example.com';
const idMock = 'user-id-123';

// endregion Mocks

// region Spies

const createSpy = jest.fn();
const findFirstSpy = jest.fn();
const findUniqueSpy = jest.fn();
const updateSpy = jest.fn();

// endregion Spies

const databaseMock = {
  client: {
    user: {
      create: createSpy,
      findFirst: findFirstSpy,
      findUnique: findUniqueSpy,
      update: updateSpy,
    },
  },
} as unknown as Database;

let setup: UserDatasource;

beforeEach(async () => {
  jest.clearAllMocks();

  const module = await Test.createTestingModule({
    providers: [
      UserDatasource,
      {
        provide: Database,
        useValue: databaseMock,
      },
    ],
  }).compile();

  setup = module.get<UserDatasource>(UserDatasource);
});

const mocks = {
  database: databaseMock,
  email: emailMock,
  id: idMock,
  user: userMock,
};

const spies = {
  create: createSpy,
  findFirst: findFirstSpy,
  findUnique: findUniqueSpy,
  update: updateSpy,
};

export { mocks, setup, spies };
