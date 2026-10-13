import { GoneException, NotFoundException } from '@nestjs/common';

import { mocks, setup, spies } from './index.mocks';

const input = { token: 'raw-token', userEmail: 'invitee@example.com' };

it('SHOULD look the invite up by the token HASH, never the raw token', async () => {
  await setup.execute(input);

  expect(spies.hashToken).toHaveBeenCalledWith('raw-token');
  expect(mocks.familyMemberRepository.findByTokenHash).toHaveBeenCalledWith('hashed-token');
});

it('SHOULD return the family name, invited email, expiry AND emailMatches=true WHEN the emails match', async () => {
  expect(await setup.execute(input)).toEqual({
    email: 'invitee@example.com',
    emailMatches: true,
    familyId: mocks.family.id,
    familyName: mocks.family.name,
    inviteExpiresAt: new Date('2026-10-11T12:00:00Z'),
  });
});

it('SHOULD match case-insensitively', async () => {
  expect((await setup.execute({ ...input, userEmail: 'INVITEE@Example.com' })).emailMatches).toBe(
    true,
  );
});

it('SHOULD return emailMatches=false AND still the invited email WHEN another account previews it', async () => {
  const result = await setup.execute({ ...input, userEmail: 'someone-else@example.com' });

  expect(result.emailMatches).toBe(false);
  expect(result.email).toBe('invitee@example.com');
});

it('SHOULD NOT consume the token (no write is ever attempted)', async () => {
  await setup.execute(input);

  expect(Object.keys(mocks.familyMemberRepository)).toEqual(['findByTokenHash']);
});

it('SHOULD throw 404 INVITE_NOT_FOUND for an unknown or already used token', async () => {
  mocks.familyMemberRepository.findByTokenHash.mockResolvedValueOnce(undefined);

  await expect(setup.execute(input)).rejects.toThrow(new NotFoundException('INVITE_NOT_FOUND'));
});

it('SHOULD throw 410 INVITE_EXPIRED WHEN the invite is past its expiry', async () => {
  jest.setSystemTime(new Date('2026-10-11T12:00:00Z'));

  await expect(setup.execute(input)).rejects.toThrow(new GoneException('INVITE_EXPIRED'));
});

it('SHOULD throw 404 INVITE_NOT_FOUND WHEN the family no longer exists', async () => {
  mocks.familyRepository.getFamilyById.mockResolvedValueOnce(undefined);

  await expect(setup.execute(input)).rejects.toThrow(new NotFoundException('INVITE_NOT_FOUND'));
});
