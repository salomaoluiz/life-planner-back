import { Test } from '@nestjs/testing';

import FamilyEntityFixture from '@family/domain/entity/mocks/FamilyEntity.fixture';

import { GetUserFamilyIdsUseCase } from './index';

// region Mocks

const fixture = new FamilyEntityFixture();
const familiesMock = [fixture.build(), fixture.build()];
const familyRepositoryMock = { getFamilies: jest.fn().mockResolvedValue(familiesMock) };

// endregion Mocks

let setup: GetUserFamilyIdsUseCase;

beforeEach(async () => {
  jest.clearAllMocks();

  const module = await Test.createTestingModule({
    providers: [
      GetUserFamilyIdsUseCase,
      { provide: 'IFamilyRepository', useValue: familyRepositoryMock },
    ],
  }).compile();

  setup = module.get(GetUserFamilyIdsUseCase);
});

const mocks = {
  families: familiesMock,
  familyRepository: familyRepositoryMock,
  userId: 'user-id-123',
};
const spies = {};

export { mocks, setup, spies };
