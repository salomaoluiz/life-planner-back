import { Test } from '@nestjs/testing';

import { UserSessionMapper } from '@user/data/datasource/mapper/UserSessionMapper';
import UserSessionEntityFixture from '@user/domain/entity/mocks/UserSessionEntity.fixture';

import { UserSessionRepository } from './index';

// region Mocks

jest.mock('@user/data/datasource/mapper/UserSessionMapper');

const sessionEntityMock = new UserSessionEntityFixture().build();

const sessionPersistenceMock = { id: 'session-id' } as ReturnType<
  typeof UserSessionMapper.toPersistence
>;

const datasourceMock = {
  create: jest.fn(),
  deleteById: jest.fn(),
  deleteByTokenHash: jest.fn(),
  deleteExpired: jest.fn(),
  findByTokenHash: jest.fn(),
  rotate: jest.fn(),
};

// endregion Mocks

// region Spies

const toDomainSpy = jest.mocked(UserSessionMapper.toDomain);
const toPersistenceSpy = jest.mocked(UserSessionMapper.toPersistence);

// endregion Spies

let setup: UserSessionRepository;

beforeEach(async () => {
  jest.clearAllMocks();
  toPersistenceSpy.mockReturnValue(sessionPersistenceMock);
  toDomainSpy.mockReturnValue(sessionEntityMock);

  const module = await Test.createTestingModule({
    providers: [
      UserSessionRepository,
      { provide: 'IUserSessionDatasource', useValue: datasourceMock },
    ],
  }).compile();

  setup = module.get<UserSessionRepository>(UserSessionRepository);
});

const mocks = {
  datasource: datasourceMock,
  entity: sessionEntityMock,
  persistence: sessionPersistenceMock,
};

const spies = { toDomain: toDomainSpy, toPersistence: toPersistenceSpy };

export { mocks, setup, spies };
