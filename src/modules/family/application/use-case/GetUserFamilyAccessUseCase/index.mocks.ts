import { Test } from '@nestjs/testing';

import FamilyEntityFixture from '@family/domain/entity/mocks/FamilyEntity.fixture';
import { FamilyStatus } from '@family/domain/enum';

import { GetUserFamilyAccessUseCase } from './index';

// region Mocks

const fixture = new FamilyEntityFixture();
const familiesMock = [fixture.build(), fixture.withStatus(FamilyStatus.ARCHIVED).build()];
const familyRepositoryMock = { getFamilies: jest.fn().mockResolvedValue(familiesMock) };

// endregion Mocks

let setup: GetUserFamilyAccessUseCase;

beforeEach(async () => {
  jest.clearAllMocks();

  const module = await Test.createTestingModule({
    providers: [
      GetUserFamilyAccessUseCase,
      { provide: 'IFamilyRepository', useValue: familyRepositoryMock },
    ],
  }).compile();

  setup = module.get(GetUserFamilyAccessUseCase);
});

const mocks = {
  families: familiesMock,
  familyRepository: familyRepositoryMock,
  userId: 'user-id-123',
};
const spies = {};

export { mocks, setup, spies };
