import { Test } from '@nestjs/testing';

import FamilyEntityFixture from '@family/domain/entity/mocks/FamilyEntity.fixture';

import { CreateFamilyUseCase } from './index';

// region Mocks

const familyMock = new FamilyEntityFixture().build();
const inputMock = {
  name: 'Example Family',
  ownerEmail: 'test@example.com',
  ownerId: familyMock.ownerId,
};

const familyRepositoryMock = { createFamily: jest.fn().mockResolvedValue(familyMock) };

// endregion Mocks

let setup: CreateFamilyUseCase;

beforeEach(async () => {
  jest.clearAllMocks();

  const module = await Test.createTestingModule({
    providers: [
      CreateFamilyUseCase,
      { provide: 'IFamilyRepository', useValue: familyRepositoryMock },
    ],
  }).compile();

  setup = module.get(CreateFamilyUseCase);
});

const mocks = { family: familyMock, familyRepository: familyRepositoryMock, input: inputMock };
const spies = {};

export { mocks, setup, spies };
