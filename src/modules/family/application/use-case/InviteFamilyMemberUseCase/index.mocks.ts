import { Test } from '@nestjs/testing';

import { EnsureFamilyOwnerUseCase } from '@family/application/use-case/EnsureFamilyOwnerUseCase';
import FamilyEntityFixture from '@family/domain/entity/mocks/FamilyEntity.fixture';
import FamilyMemberEntityFixture from '@family/domain/entity/mocks/FamilyMemberEntity.fixture';
import * as token from '@shared/infra/token';

import { InviteFamilyMemberUseCase } from './index';

// region Mocks

jest.mock('@shared/infra/token');

const familyMock = new FamilyEntityFixture().build();
const inputMock = {
  email: ' Invitee@Example.com ',
  familyId: familyMock.id,
  userId: familyMock.ownerId,
};
const createdMemberMock = new FamilyMemberEntityFixture()
  .withEmail('invitee@example.com')
  .withFamilyId(familyMock.id)
  .withInviteExpiresAt(new Date('2026-10-11T12:00:00Z'))
  .build();

const ensureFamilyOwnerUseCaseMock = { execute: jest.fn() };
const familyMemberRepositoryMock = {
  createInvite: jest.fn(),
  findByEmail: jest.fn(),
};

// endregion Mocks

// region Spies

const generateTokenSpy = jest.mocked(token.generateToken);
const hashTokenSpy = jest.mocked(token.hashToken);

// endregion Spies

let setup: InviteFamilyMemberUseCase;

beforeEach(async () => {
  jest.clearAllMocks();
  jest.useFakeTimers({ now: new Date('2026-10-04T12:00:00Z') });
  generateTokenSpy.mockReturnValue('raw-token');
  hashTokenSpy.mockReturnValue('hashed-token');
  ensureFamilyOwnerUseCaseMock.execute.mockResolvedValue(familyMock);
  familyMemberRepositoryMock.findByEmail.mockResolvedValue(undefined);
  familyMemberRepositoryMock.createInvite.mockResolvedValue(createdMemberMock);

  const module = await Test.createTestingModule({
    providers: [
      InviteFamilyMemberUseCase,
      { provide: EnsureFamilyOwnerUseCase, useValue: ensureFamilyOwnerUseCaseMock },
      { provide: 'IFamilyMemberRepository', useValue: familyMemberRepositoryMock },
    ],
  }).compile();

  setup = module.get<InviteFamilyMemberUseCase>(InviteFamilyMemberUseCase);
});

afterEach(() => {
  jest.useRealTimers();
});

const mocks = {
  createdMember: createdMemberMock,
  ensureFamilyOwnerUseCase: ensureFamilyOwnerUseCaseMock,
  family: familyMock,
  familyMemberRepository: familyMemberRepositoryMock,
  input: inputMock,
};
const spies = { generateToken: generateTokenSpy, hashToken: hashTokenSpy };

export { mocks, setup, spies };
