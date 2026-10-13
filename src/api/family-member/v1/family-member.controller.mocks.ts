import { faker } from '@faker-js/faker';
import { Test } from '@nestjs/testing';

import { FamilyMemberController } from '@api/family-member/v1/family-member.controller';
import { FamilyMemberService } from '@api/family-member/v1/family-member.service';
import { JwtPayload } from '@shared/infra/jwt/types';

// region Mocks

const userId = faker.string.uuid();
const memberApiMock = {
  email: 'invitee@example.com',
  familyId: faker.string.uuid(),
  id: faker.string.uuid(),
  inviteExpired: false,
  joinedAt: null,
  role: 'MEMBER',
  status: 'PENDING',
  user: null,
  userId: null,
};
const validToken = 'q3Jx0b9S2v1mA8kQ7rT4yU6pL5nW0zE3cF2hD1gB9aI';
const requestMock = { user: { id: userId } } as JwtPayload & Request;

const familyMemberServiceMock = {
  accept: jest.fn().mockResolvedValue(memberApiMock),
  delete: jest.fn().mockResolvedValue(undefined),
  findAll: jest.fn().mockResolvedValue([memberApiMock]),
  invite: jest
    .fn()
    .mockResolvedValue({ inviteExpiresAt: 'x', inviteToken: 't', member: memberApiMock }),
  preview: jest.fn().mockResolvedValue({ email: 'invitee@example.com' }),
};

// endregion Mocks

// region Spies

// endregion Spies

let setup: FamilyMemberController;

beforeEach(async () => {
  jest.clearAllMocks();

  const module = await Test.createTestingModule({
    controllers: [FamilyMemberController],
    providers: [{ provide: FamilyMemberService, useValue: familyMemberServiceMock }],
  }).compile();

  setup = module.get<FamilyMemberController>(FamilyMemberController);
});

const mocks = {
  familyMemberService: familyMemberServiceMock,
  member: memberApiMock,
  request: requestMock,
  token: validToken,
};
const spies = {};

export { mocks, setup, spies };
