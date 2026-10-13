import { faker } from '@faker-js/faker';

import {
  FamilyInvitePreviewApiSchema,
  FamilyMemberApiSchema,
  InviteFamilyMemberApiOutputSchema,
  InviteFamilyMemberApiSchema,
  InviteTokenApiSchema,
} from './family-member.dto';

const memberJson = {
  email: 'owner@example.com',
  familyId: faker.string.uuid(),
  id: faker.string.uuid(),
  inviteExpired: false,
  joinedAt: '2026-10-01T12:00:00.000Z',
  role: 'OWNER',
  status: 'JOINED',
  user: { name: 'Test Owner', photoUrl: null },
  userId: faker.string.uuid(),
};

describe('InviteFamilyMemberApiSchema', () => {
  it('SHOULD trim and lower-case the email', () => {
    expect(InviteFamilyMemberApiSchema.parse({ email: ' Invitee@Example.com ' })).toEqual({
      email: 'invitee@example.com',
    });
  });

  it.each([{}, { email: '' }, { email: 'nope' }, { email: null }, { email: 123 }])(
    'SHOULD reject %j',
    (body) => {
      expect(InviteFamilyMemberApiSchema.safeParse(body).success).toBe(false);
    },
  );

  it('SHOULD strip unknown keys (userId/role/status from the client are ignored)', () => {
    expect(
      InviteFamilyMemberApiSchema.parse({ email: 'a@example.com', role: 'OWNER', userId: 'x' }),
    ).toEqual({ email: 'a@example.com' });
  });
});

describe('InviteTokenApiSchema', () => {
  it('SHOULD accept a 43-char base64url token', () => {
    expect(
      InviteTokenApiSchema.safeParse('q3Jx0b9S2v1mA8kQ7rT4yU6pL5nW0zE3cF2hD1gB9aI').success,
    ).toBe(true);
  });

  it.each(['short', 'a'.repeat(44), Buffer.from('{"familyId":"1"}').toString('base64'), ''])(
    'SHOULD reject the malformed/legacy token %s',
    (token) => {
      expect(InviteTokenApiSchema.safeParse(token).success).toBe(false);
    },
  );
});

describe('FamilyMemberApiSchema', () => {
  it('SHOULD accept a joined owner AND a pending member with null user/userId/joinedAt', () => {
    expect(FamilyMemberApiSchema.safeParse(memberJson).success).toBe(true);
    expect(
      FamilyMemberApiSchema.safeParse({
        ...memberJson,
        joinedAt: null,
        role: 'MEMBER',
        status: 'PENDING',
        user: null,
        userId: null,
      }).success,
    ).toBe(true);
  });

  it('SHOULD reject an unknown role or status', () => {
    expect(FamilyMemberApiSchema.safeParse({ ...memberJson, role: 'ADMIN' }).success).toBe(false);
    expect(FamilyMemberApiSchema.safeParse({ ...memberJson, status: 'DECLINED' }).success).toBe(
      false,
    );
  });

  it('SHOULD drop any extra field such as a token (response filtering)', () => {
    const parsed = FamilyMemberApiSchema.parse({
      ...memberJson,
      invite_token: 'hash',
      inviteToken: 'secret',
      user: { name: 'N', passwordHash: 'x', photoUrl: null },
    });

    expect(JSON.stringify(parsed)).not.toContain('secret');
    expect(JSON.stringify(parsed)).not.toContain('hash');
    expect(JSON.stringify(parsed)).not.toContain('passwordHash');
  });
});

describe('InviteFamilyMemberApiOutputSchema / FamilyInvitePreviewApiSchema', () => {
  it('SHOULD require the token, expiry and member on the invite response', () => {
    expect(InviteFamilyMemberApiOutputSchema.safeParse({}).success).toBe(false);
  });

  it('SHOULD accept the preview shape', () => {
    expect(
      FamilyInvitePreviewApiSchema.safeParse({
        email: 'invitee@example.com',
        emailMatches: true,
        familyId: faker.string.uuid(),
        familyName: 'Family Example',
        inviteExpiresAt: '2026-10-11T12:00:00.000Z',
      }).success,
    ).toBe(true);
  });
});
