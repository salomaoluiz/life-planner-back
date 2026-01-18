import { Test } from '@nestjs/testing';

import { FindByIdInput } from '@user/application/dto/FindById';
import UserEntityFixture from '@user/domain/entity/mocks/UserEntity.fixture';

import { FindUserByIdUseCase } from './index';

// region Mocks

const inputMock: FindByIdInput = {
  id: 'user-uuid-123',
};

const userEntityFixture = new UserEntityFixture();
const userEntityMock = userEntityFixture.build();

const userRepositoryMock = {
  getUserById: jest.fn().mockResolvedValue(userEntityMock),
};

// endregion Mocks

// region Spies

// endregion Spies

let setup: FindUserByIdUseCase;

beforeEach(async () => {
  jest.clearAllMocks();

  const module = await Test.createTestingModule({
    providers: [
      FindUserByIdUseCase,
      {
        provide: 'IUserRepository',
        useValue: userRepositoryMock,
      },
    ],
  }).compile();

  setup = module.get<FindUserByIdUseCase>(FindUserByIdUseCase);
});

const mocks = {
  input: inputMock,
  userEntity: userEntityMock,
  userRepository: userRepositoryMock,
};

const spies = {};

export { mocks, setup, spies };
