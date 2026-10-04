import { Test } from '@nestjs/testing';

import FamilyEntityFixture from '@family/domain/entity/mocks/FamilyEntity.fixture';
import FamilyMemberEntityFixture from '@family/domain/entity/mocks/FamilyMemberEntity.fixture';
import * as token from '@shared/infra/token';

import { AcceptFamilyInviteUseCase } from './index';

// region Mocks

jest.mock('@shared/infra/token');

const familyMock = new FamilyEntityFixture().build();
const pendingMock = new FamilyMemberEntityFixture()
  .withEmail('invitee@example.com')
  .withFamilyId(familyMock.id)
  .withInviteExpiresAt(new Date('2026-10-11T12:00:00Z'))
  .build();
const joinedMock = {
  ...pendingMock,
  inviteExpiresAt: undefined,
  joinedAt: new Date('2026-10-05T12:00:00Z'),
  userId: 'accepting-user-id',
};

const familyRepositoryMock = { getFamilyById: jest.fn() };
const familyMemberRepositoryMock = {
  findByTokenHash: jest.fn(),
  findMembership: jest.fn(),
  join: jest.fn(),
};

// endregion Mocks

// region Spies

const hashTokenSpy = jest.mocked(token.hashToken);

// endregion Spies

let setup: AcceptFamilyInviteUseCase;

beforeEach(async () => {
  jest.clearAllMocks();
  jest.useFakeTimers({ now: new Date('2026-10-05T12:00:00Z') });
  hashTokenSpy.mockReturnValue('hashed-token');
  familyRepositoryMock.getFamilyById.mockResolvedValue(familyMock);
  familyMemberRepositoryMock.findByTokenHash.mockResolvedValue(pendingMock);
  familyMemberRepositoryMock.findMembership.mockResolvedValue(undefined);
  familyMemberRepositoryMock.join.mockResolvedValue(joinedMock);

  const module = await Test.createTestingModule({
    providers: [
      AcceptFamilyInviteUseCase,
      { provide: 'IFamilyRepository', useValue: familyRepositoryMock },
      { provide: 'IFamilyMemberRepository', useValue: familyMemberRepositoryMock },
    ],
  }).compile();

  setup = module.get<AcceptFamilyInviteUseCase>(AcceptFamilyInviteUseCase);
});

afterEach(() => {
  jest.useRealTimers();
});

const mocks = {
  family: familyMock,
  familyMemberRepository: familyMemberRepositoryMock,
  familyRepository: familyRepositoryMock,
  input: { token: 'raw-token', userEmail: 'invitee@example.com', userId: 'accepting-user-id' },
  joined: joinedMock,
  pending: pendingMock,
};
const spies = { hashToken: hashTokenSpy };

export { mocks, setup, spies };
