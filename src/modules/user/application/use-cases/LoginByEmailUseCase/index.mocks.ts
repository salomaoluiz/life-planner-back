import { UnauthorizedException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

import { validate } from '@shared/infra/validation';
import { LoginByEmailSchema } from '@user/application/dto/LoginByEmail';

import { LoginByEmailUseCase } from './index';

// region Mocks

jest.mock('@shared/infra/validation');

const userMock = {
  email: 'test@example.com',
  id: 'user-id-123',
  passwordHash: 'hashed_password',
};

const loginInputMock = {
  email: 'test@example.com',
  password: 'password123',
};

const tokenMock = 'jwt_token_example';

const userRepositoryMock = {
  getUserByEmail: jest.fn().mockResolvedValue(userMock),
};

const passwordHasherMock = {
  compare: jest.fn().mockResolvedValue(true),
};

const jwtProviderMock = {
  sign: jest.fn().mockResolvedValue(tokenMock),
};

// endregion Mocks

// region Spies

const validateSpy = jest.mocked(validate);

// endregion Spies

let useCase: LoginByEmailUseCase;

beforeEach(async () => {
  jest.clearAllMocks();

  const module: TestingModule = await Test.createTestingModule({
    providers: [
      LoginByEmailUseCase,
      {
        provide: 'IUserRepository',
        useValue: userRepositoryMock,
      },
      {
        provide: 'IPasswordHasherRepository',
        useValue: passwordHasherMock,
      },
      {
        provide: 'IJwtProvider',
        useValue: jwtProviderMock,
      },
    ],
  }).compile();

  useCase = module.get<LoginByEmailUseCase>(LoginByEmailUseCase);
});

async function setup(props = loginInputMock) {
  return useCase.execute(props);
}
async function throwableSetup(props = loginInputMock) {
  try {
    return await setup(props);
  } catch (error) {
    return error;
  }
}

const mocks = {
  data: {
    input: loginInputMock,
    token: tokenMock,
    user: userMock,
  },
  exceptions: {
    unauthorized: UnauthorizedException,
  },
  jwtProvider: jwtProviderMock,
  passwordHasher: passwordHasherMock,
  schemas: {
    login: LoginByEmailSchema,
  },
  userRepository: userRepositoryMock,
};

const spies = {
  validate: validateSpy,
};

export { mocks, setup, spies, throwableSetup };
