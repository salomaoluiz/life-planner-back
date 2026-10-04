import { Test } from '@nestjs/testing';

import { EnsureFamilyOwnerUseCase } from '@family/application/use-case/EnsureFamilyOwnerUseCase';

import { DeleteFamilyUseCase } from './index';

// region Mocks

const inputMock = { familyId: 'family-id-123', userId: 'user-id-123' };

const ensureFamilyOwnerUseCaseMock = { execute: jest.fn().mockResolvedValue(undefined) };
const familyRepositoryMock = { deleteFamily: jest.fn().mockResolvedValue(undefined) };

// endregion Mocks

let setup: DeleteFamilyUseCase;

beforeEach(async () => {
  jest.clearAllMocks();

  const module = await Test.createTestingModule({
    providers: [
      DeleteFamilyUseCase,
      { provide: EnsureFamilyOwnerUseCase, useValue: ensureFamilyOwnerUseCaseMock },
      { provide: 'IFamilyRepository', useValue: familyRepositoryMock },
    ],
  }).compile();

  setup = module.get(DeleteFamilyUseCase);
});

const mocks = {
  ensureFamilyOwnerUseCase: ensureFamilyOwnerUseCaseMock,
  familyRepository: familyRepositoryMock,
  input: inputMock,
};
const spies = {};

export { mocks, setup, spies };
