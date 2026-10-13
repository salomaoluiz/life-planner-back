import { Test } from '@nestjs/testing';

import { GetFamilyByIdUseCase } from '@family/application/use-case/GetFamilyByIdUseCase';
import FamilyEntityFixture from '@family/domain/entity/mocks/FamilyEntity.fixture';
import FamilyMemberEntityFixture from '@family/domain/entity/mocks/FamilyMemberEntity.fixture';

import { DeleteFamilyMemberUseCase } from './index';

// region Mocks

const familyMock = new FamilyEntityFixture().build();
const ownerUserId = familyMock.ownerId;
const memberUserId = 'member-user-id';
const otherUserId = 'other-member-user-id';

function row(id: string, userId?: string) {
  const fixture = new FamilyMemberEntityFixture().withId(id).withFamilyId(familyMock.id);

  return userId ? fixture.withUserId(userId).withJoinedAt().build() : fixture.build();
}

const ownerRow = row('owner-row', ownerUserId);
const memberRow = row('member-row', memberUserId);
const otherRow = row('other-row', otherUserId);
const pendingRow = row('pending-row');

const getFamilyByIdUseCaseMock = { execute: jest.fn() };
const familyMemberRepositoryMock = { deleteById: jest.fn(), findById: jest.fn() };

// endregion Mocks

// region Spies

// endregion Spies

let setup: DeleteFamilyMemberUseCase;

beforeEach(async () => {
  jest.clearAllMocks();
  getFamilyByIdUseCaseMock.execute.mockResolvedValue(familyMock);
  familyMemberRepositoryMock.deleteById.mockResolvedValue(undefined);

  const module = await Test.createTestingModule({
    providers: [
      DeleteFamilyMemberUseCase,
      { provide: GetFamilyByIdUseCase, useValue: getFamilyByIdUseCaseMock },
      { provide: 'IFamilyMemberRepository', useValue: familyMemberRepositoryMock },
    ],
  }).compile();

  setup = module.get<DeleteFamilyMemberUseCase>(DeleteFamilyMemberUseCase);
});

const mocks = {
  family: familyMock,
  familyMemberRepository: familyMemberRepositoryMock,
  getFamilyByIdUseCase: getFamilyByIdUseCaseMock,
  ids: { member: memberUserId, other: otherUserId, owner: ownerUserId },
  rows: { member: memberRow, other: otherRow, owner: ownerRow, pending: pendingRow },
};
const spies = {};

export { mocks, setup, spies };
