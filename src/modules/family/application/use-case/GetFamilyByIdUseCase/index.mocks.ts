import { Test } from '@nestjs/testing';

import FamilyEntityFixture from '@family/domain/entity/mocks/FamilyEntity.fixture';

import { GetFamilyByIdUseCase } from './index';

// region Mocks

const familyMock = new FamilyEntityFixture().build();
const inputMock = { familyId: familyMock.id, userId: 'user-id-123' };

const familyRepositoryMock = {
  getFamilyById: jest.fn().mockResolvedValue(familyMock),
  isFamilyMember: jest.fn().mockResolvedValue(true),
};

// endregion Mocks

let setup: GetFamilyByIdUseCase;

beforeEach(async () => {
  jest.clearAllMocks();

  const module = await Test.createTestingModule({
    providers: [
      GetFamilyByIdUseCase,
      { provide: 'IFamilyRepository', useValue: familyRepositoryMock },
    ],
  }).compile();

  setup = module.get(GetFamilyByIdUseCase);
});

const mocks = { family: familyMock, familyRepository: familyRepositoryMock, input: inputMock };
const spies = {};

export { mocks, setup, spies };
