import { Test } from '@nestjs/testing';

import { EnsureFamilyOwnerUseCase } from '@family/application/use-case/EnsureFamilyOwnerUseCase';
import FamilyEntityFixture from '@family/domain/entity/mocks/FamilyEntity.fixture';

import { UpdateFamilyUseCase } from './index';

// region Mocks

const fixture = new FamilyEntityFixture();
const familyMock = fixture.build();
const renamedMock = { ...familyMock, name: 'Renamed Family' };
const inputMock = { familyId: familyMock.id, name: 'Renamed Family', userId: familyMock.ownerId };

const ensureFamilyOwnerUseCaseMock = { execute: jest.fn().mockResolvedValue(familyMock) };
const familyRepositoryMock = { updateFamily: jest.fn().mockResolvedValue(renamedMock) };

// endregion Mocks

let setup: UpdateFamilyUseCase;

beforeEach(async () => {
  jest.clearAllMocks();

  const module = await Test.createTestingModule({
    providers: [
      UpdateFamilyUseCase,
      { provide: EnsureFamilyOwnerUseCase, useValue: ensureFamilyOwnerUseCaseMock },
      { provide: 'IFamilyRepository', useValue: familyRepositoryMock },
    ],
  }).compile();

  setup = module.get(UpdateFamilyUseCase);
});

const mocks = {
  ensureFamilyOwnerUseCase: ensureFamilyOwnerUseCaseMock,
  familyRepository: familyRepositoryMock,
  input: inputMock,
  renamed: renamedMock,
};
const spies = {};

export { mocks, setup, spies };
