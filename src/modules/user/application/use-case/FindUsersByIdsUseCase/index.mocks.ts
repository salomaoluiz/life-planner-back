import { Test } from '@nestjs/testing';

import UserEntityFixture from '@user/domain/entity/mocks/UserEntity.fixture';

import { FindUsersByIdsUseCase } from './index';

// region Mocks

const userA = new UserEntityFixture().build();
const userB = new UserEntityFixture().build();
const userWithPhoto = {
  ...new UserEntityFixture().build(),
  photoUrl: 'https://example.com/p.png',
};

const userRepositoryMock = {
  getUsersByIds: jest.fn().mockResolvedValue([userA, userB]),
};

// endregion Mocks

// region Spies

// endregion Spies

let setup: FindUsersByIdsUseCase;

beforeEach(async () => {
  jest.clearAllMocks();
  userRepositoryMock.getUsersByIds.mockResolvedValue([userA, userB]);

  const module = await Test.createTestingModule({
    providers: [
      FindUsersByIdsUseCase,
      { provide: 'IUserRepository', useValue: userRepositoryMock },
    ],
  }).compile();

  setup = module.get<FindUsersByIdsUseCase>(FindUsersByIdsUseCase);
});

const mocks = { userA, userB, userRepository: userRepositoryMock, userWithPhoto };
const spies = {};

export { mocks, setup, spies };
