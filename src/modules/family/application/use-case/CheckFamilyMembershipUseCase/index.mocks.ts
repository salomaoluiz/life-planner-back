import { Test } from '@nestjs/testing';

import { CheckFamilyMembershipUseCase } from './index';

// region Mocks

const inputMock = { familyId: 'family-id-123', userId: 'user-id-123' };
const familyRepositoryMock = { isFamilyMember: jest.fn().mockResolvedValue(true) };

// endregion Mocks

let setup: CheckFamilyMembershipUseCase;

beforeEach(async () => {
  jest.clearAllMocks();

  const module = await Test.createTestingModule({
    providers: [
      CheckFamilyMembershipUseCase,
      { provide: 'IFamilyRepository', useValue: familyRepositoryMock },
    ],
  }).compile();

  setup = module.get(CheckFamilyMembershipUseCase);
});

const mocks = { familyRepository: familyRepositoryMock, input: inputMock };
const spies = {};

export { mocks, setup, spies };
