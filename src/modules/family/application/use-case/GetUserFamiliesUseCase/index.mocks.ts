import { Test } from '@nestjs/testing';

import FamilyEntityFixture from '@family/domain/entity/mocks/FamilyEntity.fixture';

import { GetUserFamiliesUseCase } from './index';

// region Mocks

const fixture = new FamilyEntityFixture();
const banana = fixture.withName('banana').withCreatedAt(new Date('2026-01-01')).build();
const appleNewer = fixture.withName('apple').withCreatedAt(new Date('2026-01-02')).build();
const appleUpperOlder = fixture.withName('Apple').withCreatedAt(new Date('2026-01-01')).build();

const familyRepositoryMock = {
  getFamilies: jest.fn().mockResolvedValue([banana, appleNewer, appleUpperOlder]),
};

// endregion Mocks

let setup: GetUserFamiliesUseCase;

beforeEach(async () => {
  jest.clearAllMocks();

  const module = await Test.createTestingModule({
    providers: [
      GetUserFamiliesUseCase,
      { provide: 'IFamilyRepository', useValue: familyRepositoryMock },
    ],
  }).compile();

  setup = module.get(GetUserFamiliesUseCase);
});

const mocks = {
  expectedOrderIds: [appleUpperOlder.id, appleNewer.id, banana.id],
  familyRepository: familyRepositoryMock,
  userId: 'user-id-123',
};
const spies = {};

export { mocks, setup, spies };
