import { Test } from '@nestjs/testing';

import { validate } from '@shared/infra/validation';
import UserEntity from '@user/domain/entity/UserEntity';

import { SignUpByEmailUseCase } from './index';

// region Mocks

jest.mock('@shared/infra/validation');
jest.mock('@user/domain/entity/UserEntity');

const inputMock = {
  email: 'test@example.com',
  name: 'Test User',
  password: 'password123',
  photoURL: 'http://example.com/photo.jpg',
};

const hashedPasswordMock = 'hashed_password_123';

const userEntityInstanceMock = {
  email: inputMock.email,
  id: 'user_id_123',
  name: inputMock.name,
  passwordHash: hashedPasswordMock,
  photoUrl: inputMock.photoURL,
} as UserEntity;

const userRepositoryMock = {
  createUser: jest.fn(),
  getUserByEmail: jest.fn(),
};

const passwordHasherRepositoryMock = {
  hash: jest.fn().mockResolvedValue(hashedPasswordMock),
};

// endregion Mocks

// region Spies

const validateSpy = jest.mocked(validate);
const userEntitySpy = jest.mocked(UserEntity).mockImplementation(() => userEntityInstanceMock);

// endregion Spies

beforeEach(() => {
  jest.clearAllMocks();
});

let useCase: SignUpByEmailUseCase;

async function setup() {
  const module = await Test.createTestingModule({
    providers: [
      SignUpByEmailUseCase,
      {
        provide: 'IUserRepository',
        useValue: userRepositoryMock,
      },
      {
        provide: 'IPasswordHasherRepository',
        useValue: passwordHasherRepositoryMock,
      },
    ],
  }).compile();

  useCase = module.get<SignUpByEmailUseCase>(SignUpByEmailUseCase);

  return useCase;
}
async function throwableSetup(params: typeof inputMock) {
  try {
    const service = await setup();
    await service.execute(params);
  } catch (error) {
    return error;
  }
}

const mocks = {
  hashedPassword: hashedPasswordMock,
  input: inputMock,
  passwordHasherRepository: passwordHasherRepositoryMock,
  userEntityInstance: userEntityInstanceMock,
  userRepository: userRepositoryMock,
};

const spies = {
  userEntity: userEntitySpy,
  validate: validateSpy,
};

export { mocks, setup, spies, throwableSetup };
