import { Test } from '@nestjs/testing';

import { UpdateUserInput } from '@api/v1/user/dto/update-user.dto';
import { FindUserByIdUseCase } from '@user/application/use-case/FindUserByIdUseCase';
import { UpdateUserUseCase } from '@user/application/use-case/UpdateUserUseCase';

import { UserService } from './user.service';

// region Mocks

const userResultMock = {
  createdAt: new Date(),
  email: 'test@example.com',
  id: 'user-id-123',
  name: 'Test User',
  passwordHash: 'secret',
  photoUrl: 'http://example.com/photo.jpg',
  updatedAt: new Date(),
};

const updateUserInputMock: UpdateUserInput = {
  email: 'new@example.com',
  name: 'Updated User Name',
  photoUrl: 'http://example.com/new-photo.jpg',
};

const updatedUserResultMock = {
  ...userResultMock,
  ...updateUserInputMock,
};

const findUserByIdUseCaseMock = {
  execute: jest.fn().mockResolvedValue(userResultMock),
};

const updateUserUseCaseMock = {
  execute: jest.fn().mockResolvedValue(updatedUserResultMock),
};

// endregion Mocks

// region Spies

// endregion Spies

let setup: UserService;

beforeEach(async () => {
  jest.clearAllMocks();

  const module = await Test.createTestingModule({
    providers: [
      UserService,
      {
        provide: FindUserByIdUseCase,
        useValue: findUserByIdUseCaseMock,
      },
      {
        provide: UpdateUserUseCase,
        useValue: updateUserUseCaseMock,
      },
    ],
  }).compile();

  setup = module.get<UserService>(UserService);
});

const mocks = {
  findUserByIdUseCase: findUserByIdUseCaseMock,
  inputs: {
    id: userResultMock.id,
    update: updateUserInputMock,
  },
  updatedUserResult: updatedUserResultMock,
  updateUserUseCase: updateUserUseCaseMock,
  userResult: userResultMock,
};

const spies = {};

export { mocks, setup, spies };
