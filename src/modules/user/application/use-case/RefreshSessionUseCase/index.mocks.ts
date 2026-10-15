import { Test } from '@nestjs/testing';

import { EnvService } from '@shared/infra/env/env.service';
import { generateToken, hashToken } from '@shared/infra/token';
import { validate } from '@shared/infra/validation';
import UserSessionEntityFixture from '@user/domain/entity/mocks/UserSessionEntity.fixture';

import { RefreshSessionUseCase } from './index';

// region Mocks

jest.mock('@shared/infra/validation');
jest.mock('@shared/infra/token');

const TTL = 172800;
const jwtMock = 'jwt-example';

function buildSession(overrides: { lastUsedAt?: Date } = {}) {
  return new UserSessionEntityFixture()
    .withTokenHash('hash:current')
    .withPreviousTokenHash('hash:previous')
    .withRetiredTokenHash('hash:retired')
    .withLastUsedAt(overrides.lastUsedAt ?? new Date())
    .build();
}

const sessionRepositoryMock = {
  deleteSessionById: jest.fn(),
  findSessionByTokenHash: jest.fn(),
  rotateSession: jest.fn(),
};
const userRepositoryMock = { existsById: jest.fn() };
const jwtProviderMock = { sign: jest.fn() };
const envMock = { sessionIdleTtlSeconds: TTL };

// endregion Mocks

let useCase: RefreshSessionUseCase;
let session = buildSession();

beforeEach(async () => {
  jest.clearAllMocks();
  jest.mocked(validate).mockImplementation((schema, data) => schema.parse(data));
  jest.mocked(generateToken).mockReturnValue('new-token');
  jest.mocked(hashToken).mockImplementation((token) => `hash:${token}`);
  session = buildSession();
  sessionRepositoryMock.findSessionByTokenHash.mockResolvedValue(session);
  sessionRepositoryMock.rotateSession.mockResolvedValue(true);
  sessionRepositoryMock.deleteSessionById.mockResolvedValue(undefined);
  userRepositoryMock.existsById.mockResolvedValue(true);
  jwtProviderMock.sign.mockResolvedValue(jwtMock);

  const module = await Test.createTestingModule({
    providers: [
      RefreshSessionUseCase,
      { provide: 'IUserSessionRepository', useValue: sessionRepositoryMock },
      { provide: 'IUserRepository', useValue: userRepositoryMock },
      { provide: 'IJwtProvider', useValue: jwtProviderMock },
      { provide: EnvService, useValue: envMock },
    ],
  }).compile();

  useCase = module.get(RefreshSessionUseCase);
});

async function setup(refreshToken: string) {
  return useCase.execute({ refreshToken });
}
async function throwableSetup(refreshToken: string) {
  try {
    return await setup(refreshToken);
  } catch (error) {
    return error;
  }
}

const mocks = {
  buildSession,
  jwt: jwtMock,
  jwtProvider: jwtProviderMock,
  sessionRepository: sessionRepositoryMock,
  ttl: TTL,
  userRepository: userRepositoryMock,
};

const spies = {};

export { mocks, setup, spies, throwableSetup };
