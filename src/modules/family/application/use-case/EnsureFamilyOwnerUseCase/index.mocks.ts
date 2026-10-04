import { Test } from '@nestjs/testing';

import { GetFamilyByIdUseCase } from '@family/application/use-case/GetFamilyByIdUseCase';
import FamilyEntityFixture from '@family/domain/entity/mocks/FamilyEntity.fixture';

import { EnsureFamilyOwnerUseCase } from './index';

// region Mocks

const familyMock = new FamilyEntityFixture().build();
const ownerInputMock = { familyId: familyMock.id, userId: familyMock.ownerId };
const memberInputMock = { familyId: familyMock.id, userId: 'member-user-id-456' };

const getFamilyByIdUseCaseMock = { execute: jest.fn().mockResolvedValue(familyMock) };

// endregion Mocks

let setup: EnsureFamilyOwnerUseCase;

beforeEach(async () => {
  jest.clearAllMocks();

  const module = await Test.createTestingModule({
    providers: [
      EnsureFamilyOwnerUseCase,
      { provide: GetFamilyByIdUseCase, useValue: getFamilyByIdUseCaseMock },
    ],
  }).compile();

  setup = module.get(EnsureFamilyOwnerUseCase);
});

const mocks = {
  family: familyMock,
  getFamilyByIdUseCase: getFamilyByIdUseCaseMock,
  memberInput: memberInputMock,
  ownerInput: ownerInputMock,
};
const spies = {};

export { mocks, setup, spies };
