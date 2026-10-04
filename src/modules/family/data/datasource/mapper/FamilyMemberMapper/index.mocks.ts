import { FamilyMember } from '@db/client';

import { FamilyMemberMapper } from './index';

// region Mocks

const pendingMock: FamilyMember = {
  created_at: new Date('2026-10-04T12:00:00Z'),
  email: 'test@example.com',
  family_id: 'family-id',
  id: 'member-id',
  invite_expires_at: new Date('2026-10-11T12:00:00Z'),
  invite_token: 'token-hash',
  joined_at: null,
  updated_at: new Date('2026-10-04T12:00:00Z'),
  user_id: null,
};

const joinedMock: FamilyMember = {
  ...pendingMock,
  invite_expires_at: null,
  invite_token: null,
  joined_at: new Date('2026-10-05T12:00:00Z'),
  user_id: 'user-id',
};

// endregion Mocks

// region Spies

// endregion Spies

const mocks = { joined: joinedMock, pending: pendingMock };

const spies = {};

const setup = FamilyMemberMapper;

export { mocks, setup, spies };
