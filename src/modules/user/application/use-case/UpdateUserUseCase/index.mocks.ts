import { Test } from '@nestjs/testing';

import { UpdateUserInput } from '@user/application/dto/UpdateUser';
import UserEntityFixture from '@user/domain/entity/mocks/UserEntity.fixture';
import UserEntity from '@user/domain/entity/UserEntity';

import { UpdateUserUseCase } from './index';

// region Mocks

jest.mock('@user/domain/entity/UserEntity');

const userEntityFixture = new UserEntityFixture();
const existingUserMock = userEntityFixture.build();

const updateUserInputMock: UpdateUserInput = {
  email: 'new@example.com',
  id: '5e11d4ab-6d76-4360-b210-2a76a79907c1',
  name: 'New Name',
  photoUrl: 'https://example.com/new.jpg',
};

const partialUpdateUserInputMock: UpdateUserInput = {
  id: '5e11d4ab-6d76-4360-b210-2a76a79907c1',
  name: 'New Name Only',
};

// The entity returned by the update method
const updatedUserEntityMock = {
  ...existingUserMock,
  ...updateUserInputMock,
} as unknown as UserEntity;

const userRepositoryMock = {
  getUserById: jest.fn().mockResolvedValue(existingUserMock),
  updateUser: jest.fn().mockResolvedValue(updatedUserEntityMock),
};

// endregion Mocks

// region Spies

const userEntitySpy = jest.mocked(UserEntity);

// endregion Spies

let setup: UpdateUserUseCase;

beforeEach(async () => {
  jest.clearAllMocks();

  // Ensure the constructor mock returns a valid object if instantiated
  userEntitySpy.mockImplementation(() => existingUserMock);

  const module = await Test.createTestingModule({
    providers: [
      UpdateUserUseCase,
      {
        provide: 'IUserRepository',
        useValue: userRepositoryMock,
      },
    ],
  }).compile();

  setup = module.get<UpdateUserUseCase>(UpdateUserUseCase);
});

const mocks = {
  existingUser: existingUserMock,
  inputs: {
    fullUpdate: updateUserInputMock,
    partialUpdate: partialUpdateUserInputMock,
  },
  updatedUserEntity: updatedUserEntityMock,
  userRepository: userRepositoryMock,
};

const spies = {
  userEntity: userEntitySpy,
};

export { mocks, setup, spies };
