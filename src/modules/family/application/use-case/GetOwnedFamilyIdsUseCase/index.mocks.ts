import { Test } from '@nestjs/testing';

import { GetOwnedFamilyIdsUseCase } from './index';

// region Mocks

const familyRepositoryMock = { getOwnedFamilyIds: jest.fn() };

// endregion Mocks

let setup: GetOwnedFamilyIdsUseCase;

beforeEach(async () => {
  jest.clearAllMocks();

  const module = await Test.createTestingModule({
    providers: [
      GetOwnedFamilyIdsUseCase,
      { provide: 'IFamilyRepository', useValue: familyRepositoryMock },
    ],
  }).compile();

  setup = module.get(GetOwnedFamilyIdsUseCase);
});

const mocks = { familyRepository: familyRepositoryMock, userId: 'user-id-123' };
const spies = {};

export { mocks, setup, spies };
