import { Test } from '@nestjs/testing';

import { LoginWithEmailApiSchema } from '@api/v1/auth/dto/login.dto';
import { SignUpWithEmailApiSchema } from '@api/v1/auth/dto/signup.dto';
import { validate } from '@shared/infra/validation';

import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

// region Mocks

jest.mock('@shared/infra/validation');
jest.mock('@api/v1/auth/dto/login.dto');
jest.mock('@api/v1/auth/dto/signup.dto');

const loginInputMock = {
  email: 'test@example.com',
  password: 'password123',
};

const signUpInputMock = {
  email: 'newuser@example.com',
  name: 'New User',
  password: 'password123',
};

const authResultMock = {
  token: 'jwt-token-12345',
};

const authServiceMock = {
  loginWithEmail: jest.fn().mockResolvedValue(authResultMock),
  signUpWithEmail: jest.fn().mockResolvedValue(undefined),
};

// endregion Mocks

// region Spies

const validateSpy = jest.mocked(validate);
// Mocking the schemas imports to ensure we can verify they are passed
jest.mocked(LoginWithEmailApiSchema);
jest.mocked(SignUpWithEmailApiSchema);

// endregion Spies

let setup: AuthController;

beforeEach(async () => {
  jest.clearAllMocks();

  const module = await Test.createTestingModule({
    controllers: [AuthController],
    providers: [
      {
        provide: AuthService,
        useValue: authServiceMock,
      },
    ],
  }).compile();

  setup = module.get<AuthController>(AuthController);
});

const mocks = {
  authResult: authResultMock,
  authService: authServiceMock,
  inputs: {
    login: loginInputMock,
    signUp: signUpInputMock,
  },
  schemas: {
    login: LoginWithEmailApiSchema,
    signUp: SignUpWithEmailApiSchema,
  },
};

const spies = {
  validate: validateSpy,
};

export { mocks, setup, spies };
