import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';

import { EnvService } from '@shared/infra/env/env.service';
import EnvServiceFixture from '@shared/infra/env/env.service.fixture';
import { JwtPayload } from '@shared/infra/jwt/types';

import { NestJwtProvider } from './index';

// region Mocks

const payloadMock: JwtPayload = {
  user: {
    id: '5efa5f2f-756a-443c-ba0f-01b8695a98b6',
  },
};

const tokenMock = 'valid.jwt.token';

const envServiceFixture = new EnvServiceFixture();
const envServiceMock = {
  ...envServiceFixture.build(),
} as EnvService;

const loggerMock = {
  log: jest.fn(),
};

const jwtServiceMock = {
  signAsync: jest.fn().mockResolvedValue(tokenMock),
  verifyAsync: jest.fn().mockResolvedValue(payloadMock),
};

const unauthorizedExceptionMock = new UnauthorizedException('Invalid or expired token');

// endregion Mocks

// region Spies

// endregion Spies

let provider: NestJwtProvider;

beforeEach(async () => {
  jest.clearAllMocks();

  const module = await Test.createTestingModule({
    providers: [
      NestJwtProvider,
      {
        provide: EnvService,
        useValue: envServiceMock,
      },
      {
        provide: 'ILogger',
        useValue: loggerMock,
      },
      {
        provide: JwtService,
        useValue: jwtServiceMock,
      },
    ],
  }).compile();

  provider = module.get<NestJwtProvider>(NestJwtProvider);
});

function setup() {
  return provider;
}
async function throwableVerify(token: string) {
  try {
    await provider.verify(token);
  } catch (error) {
    return error;
  }
}

const mocks = {
  data: {
    payload: payloadMock,
    token: tokenMock,
  },
  envService: envServiceMock,
  exceptions: {
    unauthorized: unauthorizedExceptionMock,
  },
  jwtService: jwtServiceMock,
  logger: loggerMock,
};

const spies = {};

export { mocks, setup, spies, throwableVerify };
