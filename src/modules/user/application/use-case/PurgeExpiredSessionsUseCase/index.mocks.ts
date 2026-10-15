import { Test } from '@nestjs/testing';

import { EnvService } from '@shared/infra/env/env.service';

import { PurgeExpiredSessionsUseCase } from './index';

const sessionRepositoryMock = { deleteExpiredSessions: jest.fn() };
const envMock = { sessionIdleTtlSeconds: 172800 };

let useCase: PurgeExpiredSessionsUseCase;

beforeEach(async () => {
  jest.clearAllMocks();
  sessionRepositoryMock.deleteExpiredSessions.mockResolvedValue(4);

  const module = await Test.createTestingModule({
    providers: [
      PurgeExpiredSessionsUseCase,
      { provide: 'IUserSessionRepository', useValue: sessionRepositoryMock },
      { provide: EnvService, useValue: envMock },
    ],
  }).compile();

  useCase = module.get(PurgeExpiredSessionsUseCase);
});

async function setup() {
  return useCase.execute();
}

const mocks = { sessionRepository: sessionRepositoryMock };
const spies = {};

export { mocks, setup, spies };
