import { Test } from '@nestjs/testing';

import FamilyEntityFixture from '@family/domain/entity/mocks/FamilyEntity.fixture';
import FamilyMemberEntityFixture from '@family/domain/entity/mocks/FamilyMemberEntity.fixture';
import * as token from '@shared/infra/token';

import { GetFamilyInvitePreviewUseCase } from './index';

// region Mocks

jest.mock('@shared/infra/token');

const familyMock = new FamilyEntityFixture().build();
const pendingMock = new FamilyMemberEntityFixture()
  .withEmail('invitee@example.com')
  .withFamilyId(familyMock.id)
  .withInviteExpiresAt(new Date('2026-10-11T12:00:00Z'))
  .build();

const familyRepositoryMock = { getFamilyById: jest.fn() };
const familyMemberRepositoryMock = { findByTokenHash: jest.fn() };

// endregion Mocks

// region Spies

const hashTokenSpy = jest.mocked(token.hashToken);

// endregion Spies

let setup: GetFamilyInvitePreviewUseCase;

beforeEach(async () => {
  jest.clearAllMocks();
  jest.useFakeTimers({ now: new Date('2026-10-05T12:00:00Z') });
  hashTokenSpy.mockReturnValue('hashed-token');
  familyRepositoryMock.getFamilyById.mockResolvedValue(familyMock);
  familyMemberRepositoryMock.findByTokenHash.mockResolvedValue(pendingMock);

  const module = await Test.createTestingModule({
    providers: [
      GetFamilyInvitePreviewUseCase,
      { provide: 'IFamilyRepository', useValue: familyRepositoryMock },
      { provide: 'IFamilyMemberRepository', useValue: familyMemberRepositoryMock },
    ],
  }).compile();

  setup = module.get<GetFamilyInvitePreviewUseCase>(GetFamilyInvitePreviewUseCase);
});

afterEach(() => {
  jest.useRealTimers();
});

const mocks = {
  family: familyMock,
  familyMemberRepository: familyMemberRepositoryMock,
  familyRepository: familyRepositoryMock,
  pending: pendingMock,
};
const spies = { hashToken: hashTokenSpy };

export { mocks, setup, spies };
