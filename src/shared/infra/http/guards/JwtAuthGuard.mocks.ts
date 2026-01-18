import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { IS_PUBLIC_KEY } from '@shared/infra/http/decorators/Public';
import { IJwtProvider } from '@shared/infra/jwt/types';

import { JwtAuthGuard } from './JwtAuthGuard';

// region Mocks

const userMock = {
  email: 'test@example.com',
  id: 'user-id',
};

const jwtProviderMock = {
  sign: jest.fn(),
  verify: jest.fn(),
} as IJwtProvider;

const reflectorMock = {
  getAllAndOverride: jest.fn(),
} as unknown as Reflector;

const headersMapMock = {
  authorization: 'Bearer valid_token',
};

const requestMock = {
  headers: headersMapMock,
  user: null,
};

const switchToHttpMock = {
  getRequest: jest.fn().mockReturnValue(requestMock),
};

const executionContextMock = {
  getClass: jest.fn(),
  getHandler: jest.fn(),
  switchToHttp: jest.fn().mockReturnValue(switchToHttpMock),
} as unknown as ExecutionContext;

// endregion Mocks

// region Spies

const jwtVerifySpy = jest.mocked(jwtProviderMock.verify);
const reflectorGetAllAndOverrideSpy = jest.mocked(reflectorMock.getAllAndOverride);

// endregion Spies

beforeEach(() => {
  jest.clearAllMocks();
  // Default behaviors
  reflectorGetAllAndOverrideSpy.mockReturnValue(false); // Not public by default
  jwtVerifySpy.mockResolvedValue({ user: userMock }); // Valid token verification by default
});

function setup() {
  return new JwtAuthGuard(jwtProviderMock, reflectorMock);
}
async function throwableSetup() {
  try {
    const guard = setup();
    await guard.canActivate(executionContextMock);
  } catch (error) {
    return error;
  }
}

const spies = {
  jwtVerify: jwtVerifySpy,
  reflectorGetAllAndOverride: reflectorGetAllAndOverrideSpy,
};

const mocks = {
  constants: {
    IS_PUBLIC_KEY,
  },
  context: executionContextMock,
  jwtProvider: jwtProviderMock,
  reflector: reflectorMock,
  request: requestMock,
  switchToHttp: switchToHttpMock,
  user: userMock,
};

export { mocks, setup, spies, throwableSetup };
