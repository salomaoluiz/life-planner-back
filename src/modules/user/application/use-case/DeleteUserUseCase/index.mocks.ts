import { faker } from '@faker-js/faker';
import { Test } from '@nestjs/testing';

import { DeleteUserUseCase } from './index';

// region Mocks

const userRepositoryMock = { deleteUser: jest.fn() };

// endregion Mocks

let setup: DeleteUserUseCase;

beforeEach(async () => {
  jest.clearAllMocks();
  userRepositoryMock.deleteUser.mockResolvedValue(undefined);

  const module = await Test.createTestingModule({
    providers: [DeleteUserUseCase, { provide: 'IUserRepository', useValue: userRepositoryMock }],
  }).compile();

  setup = module.get(DeleteUserUseCase);
});

const mocks = { userId: faker.string.uuid(), userRepository: userRepositoryMock };
const spies = {};

export { mocks, setup, spies };
