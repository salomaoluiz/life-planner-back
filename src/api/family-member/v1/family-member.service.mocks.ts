import { faker } from '@faker-js/faker';
import { Test } from '@nestjs/testing';

import { FamilyMemberService } from '@api/family-member/v1/family-member.service';
import { AcceptFamilyInviteUseCase } from '@family/application/use-case/AcceptFamilyInviteUseCase';
import { DeleteFamilyMemberUseCase } from '@family/application/use-case/DeleteFamilyMemberUseCase';
import { GetFamilyInvitePreviewUseCase } from '@family/application/use-case/GetFamilyInvitePreviewUseCase';
import { GetFamilyMembersUseCase } from '@family/application/use-case/GetFamilyMembersUseCase';
import { InviteFamilyMemberUseCase } from '@family/application/use-case/InviteFamilyMemberUseCase';
import { FindUserByIdUseCase } from '@user/application/use-case/FindUserByIdUseCase';
import { FindUsersByIdsUseCase } from '@user/application/use-case/FindUsersByIdsUseCase';

// region Mocks

const userId = faker.string.uuid();
const otherUserId = faker.string.uuid();
const familyId = faker.string.uuid();

function outputRow(overrides: Record<string, unknown> = {}) {
  return {
    createdAt: new Date('2026-10-01T10:00:00Z'),
    email: 'owner@example.com',
    familyId,
    id: faker.string.uuid(),
    inviteExpired: false,
    inviteExpiresAt: undefined,
    joinedAt: new Date('2026-10-01T12:00:00Z'),
    role: 'OWNER',
    status: 'JOINED',
    userId,
    ...overrides,
  };
}

const ownerRow = outputRow();
const joinedRow = outputRow({ email: 'm@example.com', role: 'MEMBER', userId: otherUserId });
const pendingRow = outputRow({
  email: 'invitee@example.com',
  inviteExpiresAt: new Date('2026-10-11T12:00:00Z'),
  joinedAt: undefined,
  role: 'MEMBER',
  status: 'PENDING',
  userId: undefined,
});

const callerMock = {
  email: 'caller@example.com',
  id: userId,
  name: 'Caller',
  photoUrl: 'https://example.com/c.png',
};

const acceptFamilyInviteUseCaseMock = { execute: jest.fn() };
const deleteFamilyMemberUseCaseMock = { execute: jest.fn() };
const findUserByIdUseCaseMock = { execute: jest.fn() };
const findUsersByIdsUseCaseMock = { execute: jest.fn() };
const getFamilyInvitePreviewUseCaseMock = { execute: jest.fn() };
const getFamilyMembersUseCaseMock = { execute: jest.fn() };
const inviteFamilyMemberUseCaseMock = { execute: jest.fn() };
const loggerMock = { log: jest.fn() };

// endregion Mocks

// region Spies

// endregion Spies

let setup: FamilyMemberService;

beforeEach(async () => {
  jest.clearAllMocks();
  findUserByIdUseCaseMock.execute.mockResolvedValue(callerMock);
  findUsersByIdsUseCaseMock.execute.mockResolvedValue([
    { email: 'owner@example.com', id: userId, name: 'Test Owner', photoUrl: undefined },
    {
      email: 'm@example.com',
      id: otherUserId,
      name: 'Member',
      photoUrl: 'https://example.com/m.png',
    },
  ]);
  getFamilyMembersUseCaseMock.execute.mockResolvedValue([ownerRow, joinedRow, pendingRow]);

  const module = await Test.createTestingModule({
    providers: [
      FamilyMemberService,
      { provide: AcceptFamilyInviteUseCase, useValue: acceptFamilyInviteUseCaseMock },
      { provide: DeleteFamilyMemberUseCase, useValue: deleteFamilyMemberUseCaseMock },
      { provide: FindUserByIdUseCase, useValue: findUserByIdUseCaseMock },
      { provide: FindUsersByIdsUseCase, useValue: findUsersByIdsUseCaseMock },
      { provide: GetFamilyInvitePreviewUseCase, useValue: getFamilyInvitePreviewUseCaseMock },
      { provide: GetFamilyMembersUseCase, useValue: getFamilyMembersUseCaseMock },
      { provide: InviteFamilyMemberUseCase, useValue: inviteFamilyMemberUseCaseMock },
      { provide: 'ILogger', useValue: loggerMock },
    ],
  }).compile();

  setup = module.get<FamilyMemberService>(FamilyMemberService);
});

const mocks = {
  acceptFamilyInviteUseCase: acceptFamilyInviteUseCaseMock,
  caller: callerMock,
  deleteFamilyMemberUseCase: deleteFamilyMemberUseCaseMock,
  familyId,
  findUserByIdUseCase: findUserByIdUseCaseMock,
  findUsersByIdsUseCase: findUsersByIdsUseCaseMock,
  getFamilyInvitePreviewUseCase: getFamilyInvitePreviewUseCaseMock,
  getFamilyMembersUseCase: getFamilyMembersUseCaseMock,
  inviteFamilyMemberUseCase: inviteFamilyMemberUseCaseMock,
  logger: loggerMock,
  otherUserId,
  rows: { joined: joinedRow, owner: ownerRow, pending: pendingRow },
  userId,
};
const spies = {};

export { mocks, setup, spies };
