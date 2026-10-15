import { Test } from '@nestjs/testing';

import { UserExistsUseCase } from './index';

// region Mocks

const userRepositoryMock = { existsById: jest.fn() };

// endregion Mocks

let setup: UserExistsUseCase;

beforeEach(async () => {
  jest.clearAllMocks();

  const module = await Test.createTestingModule({
    providers: [UserExistsUseCase, { provide: 'IUserRepository', useValue: userRepositoryMock }],
  }).compile();

  setup = module.get(UserExistsUseCase);
});

const mocks = { userId: 'user-id-123', userRepository: userRepositoryMock };
const spies = {};

export { mocks, setup, spies };
