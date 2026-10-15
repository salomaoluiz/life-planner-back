import { Test } from '@nestjs/testing';

import { LoginWithEmailApiSchema } from '@api/auth/v1/dto/login.dto';
import { RefreshApiSchema } from '@api/auth/v1/dto/refresh.dto';
import { SignUpWithEmailApiSchema } from '@api/auth/v1/dto/signup.dto';
import { validate } from '@shared/infra/validation';

import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

// region Mocks

jest.mock('@shared/infra/validation');
jest.mock('@api/auth/v1/dto/login.dto');
jest.mock('@api/auth/v1/dto/signup.dto');
jest.mock('@api/auth/v1/dto/refresh.dto');

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
  refreshToken: 'refresh-token-12345',
  refreshTokenExpiresIn: 172800,
  token: 'jwt-token-12345',
};

const refreshInputMock = { refreshToken: 'refresh-token-12345' };

const authServiceMock = {
  loginWithEmail: jest.fn().mockResolvedValue(authResultMock),
  logout: jest.fn().mockResolvedValue(undefined),
  refreshSession: jest.fn().mockResolvedValue(authResultMock),
  signUpWithEmail: jest.fn().mockResolvedValue(undefined),
};

// endregion Mocks

// region Spies

const parsedLoginMock = { email: 'test@example.com', password: 'password123' };
const parsedSignUpMock = {
  email: 'newuser@example.com',
  name: 'New User',
  password: 'password123',
};

const parsedRefreshMock = { refreshToken: 'refresh-token-12345' };

function parsedFor(schema: unknown) {
  if (schema === LoginWithEmailApiSchema) return parsedLoginMock;
  if (schema === RefreshApiSchema) return parsedRefreshMock;
  return parsedSignUpMock;
}

const validateSpy = jest.mocked(validate).mockImplementation((schema) => parsedFor(schema));
// Mocking the schemas imports to ensure we can verify they are passed
jest.mocked(LoginWithEmailApiSchema);
jest.mocked(SignUpWithEmailApiSchema);
jest.mocked(RefreshApiSchema);

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
    refresh: refreshInputMock,
    signUp: signUpInputMock,
  },
  parsed: {
    login: parsedLoginMock,
    refresh: parsedRefreshMock,
    signUp: parsedSignUpMock,
  },
  schemas: {
    login: LoginWithEmailApiSchema,
    refresh: RefreshApiSchema,
    signUp: SignUpWithEmailApiSchema,
  },
};

const spies = {
  validate: validateSpy,
};

export { mocks, setup, spies };
