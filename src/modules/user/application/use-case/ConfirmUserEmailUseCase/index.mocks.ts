import { faker } from '@faker-js/faker';
import { Test } from '@nestjs/testing';

import UserEntityFixture from '@user/domain/entity/mocks/UserEntity.fixture';

import { ConfirmUserEmailUseCase } from './index';

// region Mocks

const userMock = new UserEntityFixture().withEmail('test@example.com').build();
const userIdMock = faker.string.uuid();
const userRepositoryMock = { getUserById: jest.fn() };

// endregion Mocks

let setup: ConfirmUserEmailUseCase;

beforeEach(async () => {
  jest.clearAllMocks();
  userRepositoryMock.getUserById.mockResolvedValue(userMock);

  const module = await Test.createTestingModule({
    providers: [
      ConfirmUserEmailUseCase,
      { provide: 'IUserRepository', useValue: userRepositoryMock },
    ],
  }).compile();

  setup = module.get(ConfirmUserEmailUseCase);
});

const mocks = { user: userMock, userId: userIdMock, userRepository: userRepositoryMock };
const spies = {};

export { mocks, setup, spies };
