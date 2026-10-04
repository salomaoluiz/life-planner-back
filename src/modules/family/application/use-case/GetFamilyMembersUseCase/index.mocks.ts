import { Test } from '@nestjs/testing';

import { GetFamilyByIdUseCase } from '@family/application/use-case/GetFamilyByIdUseCase';
import FamilyEntityFixture from '@family/domain/entity/mocks/FamilyEntity.fixture';
import FamilyMemberEntityFixture from '@family/domain/entity/mocks/FamilyMemberEntity.fixture';

import { GetFamilyMembersUseCase } from './index';

// region Mocks

const familyMock = new FamilyEntityFixture().build();
const ownerUserId = familyMock.ownerId;

function member() {
  return new FamilyMemberEntityFixture().withFamilyId(familyMock.id);
}

const ownerRow = member()
  .withId('owner-row')
  .withUserId(ownerUserId)
  .withJoinedAt(new Date('2026-01-01T00:00:00Z'))
  .withCreatedAt(new Date('2026-01-01T00:00:00Z'))
  .build();
const joinedLate = member()
  .withId('joined-late')
  .withUserId('u-late')
  .withJoinedAt(new Date('2026-03-01T00:00:00Z'))
  .withCreatedAt(new Date('2026-01-05T00:00:00Z'))
  .build();
const joinedEarly = member()
  .withId('joined-early')
  .withUserId('u-early')
  .withJoinedAt(new Date('2026-02-01T00:00:00Z'))
  .withCreatedAt(new Date('2026-01-10T00:00:00Z'))
  .build();
const pendingOld = member()
  .withId('pending-old')
  .withCreatedAt(new Date('2026-01-02T00:00:00Z'))
  .withInviteExpiresAt(new Date('2099-01-01T00:00:00Z'))
  .build();
const pendingNew = member()
  .withId('pending-new')
  .withCreatedAt(new Date('2026-01-20T00:00:00Z'))
  .withInviteExpiresAt(new Date('2000-01-01T00:00:00Z'))
  .build();

const getFamilyByIdUseCaseMock = { execute: jest.fn() };
const familyMemberRepositoryMock = { findByFamilyId: jest.fn() };

// endregion Mocks

// region Spies

// endregion Spies

let setup: GetFamilyMembersUseCase;

beforeEach(async () => {
  jest.clearAllMocks();
  getFamilyByIdUseCaseMock.execute.mockResolvedValue(familyMock);
  // Deliberately unsorted.
  familyMemberRepositoryMock.findByFamilyId.mockResolvedValue([
    pendingNew,
    joinedLate,
    pendingOld,
    ownerRow,
    joinedEarly,
  ]);

  const module = await Test.createTestingModule({
    providers: [
      GetFamilyMembersUseCase,
      { provide: GetFamilyByIdUseCase, useValue: getFamilyByIdUseCaseMock },
      { provide: 'IFamilyMemberRepository', useValue: familyMemberRepositoryMock },
    ],
  }).compile();

  setup = module.get<GetFamilyMembersUseCase>(GetFamilyMembersUseCase);
});

const mocks = {
  family: familyMock,
  familyMemberRepository: familyMemberRepositoryMock,
  getFamilyByIdUseCase: getFamilyByIdUseCaseMock,
  input: { familyId: familyMock.id, userId: ownerUserId },
};
const spies = {};

export { mocks, setup, spies };
