import {
  ConflictException,
  ForbiddenException,
  GoneException,
  NotFoundException,
} from '@nestjs/common';

import { mocks, setup, spies } from './index.mocks';

it('SHOULD join the caller with SERVER time AND return the JOINED MEMBER view', async () => {
  const result = await setup.execute(mocks.input);

  expect(spies.hashToken).toHaveBeenCalledWith('raw-token');
  expect(mocks.familyMemberRepository.join).toHaveBeenCalledWith({
    id: mocks.pending.id,
    joinedAt: new Date('2026-10-05T12:00:00Z'),
    userId: 'accepting-user-id',
  });
  expect(result).toMatchObject({
    id: mocks.pending.id,
    inviteExpired: false,
    role: 'MEMBER',
    status: 'JOINED',
    userId: 'accepting-user-id',
  });
});

it('SHOULD report role OWNER WHEN the joined user is the family owner', async () => {
  mocks.familyRepository.getFamilyById.mockResolvedValueOnce({
    ...mocks.family,
    ownerId: 'accepting-user-id',
  });

  expect((await setup.execute(mocks.input)).role).toBe('OWNER');
});

it('SHOULD accept an email that differs only by case', async () => {
  await expect(
    setup.execute({ ...mocks.input, userEmail: 'Invitee@EXAMPLE.com' }),
  ).resolves.toBeDefined();
});

it('SHOULD throw 404 INVITE_NOT_FOUND for a forged/unknown/used token AND write nothing', async () => {
  mocks.familyMemberRepository.findByTokenHash.mockResolvedValueOnce(undefined);

  await expect(setup.execute(mocks.input)).rejects.toThrow(
    new NotFoundException('INVITE_NOT_FOUND'),
  );
  expect(mocks.familyMemberRepository.join).not.toHaveBeenCalled();
});

it('SHOULD throw 410 INVITE_EXPIRED AND write nothing WHEN the invite expired', async () => {
  jest.setSystemTime(new Date('2026-10-11T12:00:01Z'));

  await expect(setup.execute(mocks.input)).rejects.toThrow(new GoneException('INVITE_EXPIRED'));
  expect(mocks.familyMemberRepository.join).not.toHaveBeenCalled();
});

it('SHOULD throw 403 INVITE_EMAIL_MISMATCH AND leave the row pending WHEN another account accepts', async () => {
  await expect(
    setup.execute({ ...mocks.input, userEmail: 'someone-else@example.com' }),
  ).rejects.toThrow(new ForbiddenException('INVITE_EMAIL_MISMATCH'));
  expect(mocks.familyMemberRepository.join).not.toHaveBeenCalled();
});

it('SHOULD check expiry BEFORE the email (410 wins over 403)', async () => {
  jest.setSystemTime(new Date('2026-10-12T00:00:00Z'));

  await expect(
    setup.execute({ ...mocks.input, userEmail: 'someone-else@example.com' }),
  ).rejects.toThrow(GoneException);
});

it('SHOULD throw 409 WHEN the user is already a JOINED member of that family through another row', async () => {
  mocks.familyMemberRepository.findMembership.mockResolvedValueOnce(mocks.joined);

  await expect(setup.execute(mocks.input)).rejects.toThrow(
    new ConflictException('FAMILY_MEMBER_ALREADY_EXISTS'),
  );
  expect(mocks.familyMemberRepository.findMembership).toHaveBeenCalledWith({
    familyId: mocks.pending.familyId,
    userId: 'accepting-user-id',
  });
  expect(mocks.familyMemberRepository.join).not.toHaveBeenCalled();
});

it('SHOULD throw 404 INVITE_NOT_FOUND WHEN a concurrent accept already consumed the row', async () => {
  mocks.familyMemberRepository.join.mockResolvedValueOnce(undefined);

  await expect(setup.execute(mocks.input)).rejects.toThrow(
    new NotFoundException('INVITE_NOT_FOUND'),
  );
});

it('SHOULD throw 404 INVITE_NOT_FOUND WHEN the family disappeared', async () => {
  mocks.familyRepository.getFamilyById.mockResolvedValueOnce(undefined);

  await expect(setup.execute(mocks.input)).rejects.toThrow(
    new NotFoundException('INVITE_NOT_FOUND'),
  );
});
