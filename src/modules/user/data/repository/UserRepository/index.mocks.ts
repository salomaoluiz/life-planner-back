import { Test } from '@nestjs/testing';

import { UserMapper } from '@user/data/datasource/mapper/UserMapper';
import UserEntityFixture from '@user/domain/entity/mocks/UserEntity.fixture';

import { UserRepository } from './index';

// region Mocks

jest.mock('@user/data/datasource/mapper/UserMapper');

const userEntityFixture = new UserEntityFixture();
const userEntityMock = {
  ...userEntityFixture.build(),
};

const userPersistenceMock = {
  email: 'test@example.com',
  id: '12345',
  name: 'Test User',
  password_hash: 'hashedpassword',
  photo_url: 'https://example.com/photo.jpg',
} as ReturnType<typeof UserMapper.toPersistence>;

const userDatasourceMock = {
  create: jest.fn().mockResolvedValue(userPersistenceMock),
  findByEmail: jest.fn().mockResolvedValue(userPersistenceMock),
  findById: jest.fn().mockResolvedValue(userPersistenceMock),
  update: jest.fn().mockResolvedValue(userPersistenceMock),
};

// endregion Mocks

// region Spies

const userMapperToPersistenceSpy = jest.mocked(UserMapper.toPersistence);
const userMapperToDomainSpy = jest.mocked(UserMapper.toDomain);

// endregion Spies

let setup: UserRepository;

beforeEach(async () => {
  jest.clearAllMocks();

  const module = await Test.createTestingModule({
    providers: [
      UserRepository,
      {
        provide: 'IUserDatasource',
        useValue: userDatasourceMock,
      },
    ],
  }).compile();

  setup = module.get<UserRepository>(UserRepository);
});

const mocks = {
  userDatasource: userDatasourceMock,
  userEntity: userEntityMock,
  userPersistence: userPersistenceMock,
};

const spies = {
  userDatasource: userDatasourceMock,
  userMapper: {
    toDomain: userMapperToDomainSpy,
    toPersistence: userMapperToPersistenceSpy,
  },
};

export { mocks, setup, spies };
