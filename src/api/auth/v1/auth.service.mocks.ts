import { Test } from '@nestjs/testing';

import { LoginByEmailUseCase } from '@user/application/use-case/LoginByEmailUseCase';
import { PurgeExpiredSessionsUseCase } from '@user/application/use-case/PurgeExpiredSessionsUseCase';
import { RefreshSessionUseCase } from '@user/application/use-case/RefreshSessionUseCase';
import { RevokeSessionUseCase } from '@user/application/use-case/RevokeSessionUseCase';
import { SignUpByEmailUseCase } from '@user/application/use-case/SignUpByEmailUseCase';

import { AuthService } from './auth.service';

// region Mocks

const loginInputMock = {
  email: 'test@example.com',
  password: 'password123',
};

const signUpInputMock = {
  email: 'newuser@example.com',
  name: 'New User',
  password: 'securePass123',
  photoURL: 'http://example.com/photo.jpg',
};

const loginUseCaseResultMock = {
  refreshToken: 'refresh-token-example',
  refreshTokenExpiresIn: 172800,
  token: 'jwt-token-example-123',
};

const refreshInputMock = { refreshToken: 'refresh-token-example' };

const loginByEmailUseCaseMock = {
  execute: jest.fn().mockResolvedValue(loginUseCaseResultMock),
};

const refreshSessionUseCaseMock = {
  execute: jest.fn().mockResolvedValue(loginUseCaseResultMock),
};

const revokeSessionUseCaseMock = {
  execute: jest.fn().mockResolvedValue(undefined),
};

const purgeExpiredSessionsUseCaseMock = {
  execute: jest.fn().mockResolvedValue(0),
};

const loggerMock = { log: jest.fn() };

const signUpByEmailUseCaseMock = {
  execute: jest.fn().mockResolvedValue(undefined),
};

// endregion Mocks

// region Spies

// endregion Spies

let setup: AuthService;

beforeEach(async () => {
  jest.clearAllMocks();
  purgeExpiredSessionsUseCaseMock.execute.mockResolvedValue(0);

  const module = await Test.createTestingModule({
    providers: [
      AuthService,
      {
        provide: LoginByEmailUseCase,
        useValue: loginByEmailUseCaseMock,
      },
      { provide: RefreshSessionUseCase, useValue: refreshSessionUseCaseMock },
      { provide: RevokeSessionUseCase, useValue: revokeSessionUseCaseMock },
      { provide: PurgeExpiredSessionsUseCase, useValue: purgeExpiredSessionsUseCaseMock },
      { provide: 'ILogger', useValue: loggerMock },
      {
        provide: SignUpByEmailUseCase,
        useValue: signUpByEmailUseCaseMock,
      },
    ],
  }).compile();

  setup = module.get<AuthService>(AuthService);
});

const mocks = {
  inputs: {
    login: loginInputMock,
    refresh: refreshInputMock,
    signUp: signUpInputMock,
  },
  logger: loggerMock,
  loginByEmailUseCase: loginByEmailUseCaseMock,
  loginUseCaseResult: loginUseCaseResultMock,
  purgeExpiredSessionsUseCase: purgeExpiredSessionsUseCaseMock,
  refreshSessionUseCase: refreshSessionUseCaseMock,
  revokeSessionUseCase: revokeSessionUseCaseMock,
  signUpByEmailUseCase: signUpByEmailUseCaseMock,
};

const spies = {};

export { mocks, setup, spies };
