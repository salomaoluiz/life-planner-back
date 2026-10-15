import { Test } from '@nestjs/testing';

import { hashToken } from '@shared/infra/token';
import { validate } from '@shared/infra/validation';

import { RevokeSessionUseCase } from './index';

jest.mock('@shared/infra/validation');
jest.mock('@shared/infra/token');

const sessionRepositoryMock = { deleteSessionByTokenHash: jest.fn() };

let useCase: RevokeSessionUseCase;

beforeEach(async () => {
  jest.clearAllMocks();
  jest.mocked(validate).mockImplementation((schema, data) => schema.parse(data));
  jest.mocked(hashToken).mockImplementation((token) => `hash:${token}`);
  sessionRepositoryMock.deleteSessionByTokenHash.mockResolvedValue(undefined);

  const module = await Test.createTestingModule({
    providers: [
      RevokeSessionUseCase,
      { provide: 'IUserSessionRepository', useValue: sessionRepositoryMock },
    ],
  }).compile();

  useCase = module.get(RevokeSessionUseCase);
});

async function setup(refreshToken: string) {
  return useCase.execute({ refreshToken });
}

const mocks = { sessionRepository: sessionRepositoryMock };
const spies = {};

export { mocks, setup, spies };
