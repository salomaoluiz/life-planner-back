import { UnauthorizedException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

import { EnvService } from '@shared/infra/env/env.service';
import { generateToken, hashToken } from '@shared/infra/token';
import { validate } from '@shared/infra/validation';
import { LoginByEmailInput, LoginByEmailSchema } from '@user/application/dto/LoginByEmail';

import { LoginByEmailUseCase } from './index';

// region Mocks

jest.mock('@shared/infra/validation');
jest.mock('@shared/infra/token');

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
const refreshTokenMock = 'refresh-token-example';
const refreshHashMock = 'refresh-hash-example';

const sessionRepositoryMock = {
  createSession: jest.fn().mockResolvedValue(undefined),
};

const envMock = { sessionIdleTtlSeconds: 172800 };

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

const validateSpy = jest.mocked(validate).mockImplementation((schema, data) => schema.parse(data));

// endregion Spies

let useCase: LoginByEmailUseCase;

beforeEach(async () => {
  jest.clearAllMocks();
  jest.mocked(generateToken).mockReturnValue(refreshTokenMock);
  jest.mocked(hashToken).mockReturnValue(refreshHashMock);

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
      {
        provide: 'IUserSessionRepository',
        useValue: sessionRepositoryMock,
      },
      {
        provide: EnvService,
        useValue: envMock,
      },
    ],
  }).compile();

  useCase = module.get<LoginByEmailUseCase>(LoginByEmailUseCase);
});

async function setup(props: LoginByEmailInput = loginInputMock) {
  return useCase.execute(props);
}
async function throwableSetup(props: LoginByEmailInput = loginInputMock) {
  try {
    return await setup(props);
  } catch (error) {
    return error;
  }
}

const mocks = {
  data: {
    input: loginInputMock,
    refreshHash: refreshHashMock,
    refreshToken: refreshTokenMock,
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
  sessionRepository: sessionRepositoryMock,
  userRepository: userRepositoryMock,
};

const spies = {
  validate: validateSpy,
};

export { mocks, setup, spies, throwableSetup };
