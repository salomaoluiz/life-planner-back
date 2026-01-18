import { Test } from '@nestjs/testing';

import { LoginByEmailUseCase } from '@user/application/use-cases/LoginByEmailUseCase';
import { SignUpByEmailUseCase } from '@user/application/use-cases/SignUpByEmailUseCase';

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
  token: 'jwt-token-example-123',
  user: {
    email: 'test@example.com',
    id: 'user-id-123',
  },
};

const loginByEmailUseCaseMock = {
  execute: jest.fn().mockResolvedValue(loginUseCaseResultMock),
};

const signUpByEmailUseCaseMock = {
  execute: jest.fn().mockResolvedValue(undefined),
};

// endregion Mocks

// region Spies

// endregion Spies

let setup: AuthService;

beforeEach(async () => {
  jest.clearAllMocks();

  const module = await Test.createTestingModule({
    providers: [
      AuthService,
      {
        provide: LoginByEmailUseCase,
        useValue: loginByEmailUseCaseMock,
      },
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
    signUp: signUpInputMock,
  },
  loginByEmailUseCase: loginByEmailUseCaseMock,
  loginUseCaseResult: loginUseCaseResultMock,
  signUpByEmailUseCase: signUpByEmailUseCaseMock,
};

const spies = {};

export { mocks, setup, spies };
