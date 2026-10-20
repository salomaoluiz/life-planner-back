import { Test } from '@nestjs/testing';

import FamilyMemberEntityFixture from '@family/domain/entity/mocks/FamilyMemberEntity.fixture';

import { GetFamilyPendingInvitesUseCase } from './index';

// region Mocks

const fixture = new FamilyMemberEntityFixture();
const joinedMock = fixture.withId('joined').withUserId('user-1').build();
const pendingMock = {
  ...fixture.withId('pending').withEmail('test@example.com').build(),
  userId: undefined,
};
const familyMemberRepositoryMock = {
  findByFamilyId: jest.fn().mockResolvedValue([joinedMock, pendingMock]),
};

// endregion Mocks

let setup: GetFamilyPendingInvitesUseCase;

beforeEach(async () => {
  jest.clearAllMocks();

  const module = await Test.createTestingModule({
    providers: [
      GetFamilyPendingInvitesUseCase,
      { provide: 'IFamilyMemberRepository', useValue: familyMemberRepositoryMock },
    ],
  }).compile();

  setup = module.get(GetFamilyPendingInvitesUseCase);
});

const mocks = { familyMemberRepository: familyMemberRepositoryMock, pending: pendingMock };
const spies = {};

export { mocks, setup, spies };
