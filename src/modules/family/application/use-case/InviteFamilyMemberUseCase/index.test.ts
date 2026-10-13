import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';

import { ValidationError } from '@shared/domain/error/ValidationError';

import { mocks, setup, spies } from './index.mocks';

it('SHOULD require the caller to be the family owner (404 before 403)', async () => {
  await setup.execute(mocks.input);

  expect(mocks.ensureFamilyOwnerUseCase.execute).toHaveBeenCalledWith({
    familyId: mocks.family.id,
    userId: mocks.family.ownerId,
  });
});

it.each([
  ['non-owner member', new ForbiddenException()],
  ['non-member / unknown family', new NotFoundException()],
])('SHOULD propagate the owner check failure for a %s AND create nothing', async (_l, error) => {
  mocks.ensureFamilyOwnerUseCase.execute.mockRejectedValueOnce(error);

  await expect(setup.execute(mocks.input)).rejects.toBe(error);
  expect(mocks.familyMemberRepository.createInvite).not.toHaveBeenCalled();
  expect(spies.generateToken).not.toHaveBeenCalled();
});

it('SHOULD normalise the email, store ONLY the token hash AND expire in 7 days', async () => {
  await setup.execute(mocks.input);

  expect(mocks.familyMemberRepository.findByEmail).toHaveBeenCalledWith({
    email: 'invitee@example.com',
    familyId: mocks.family.id,
  });
  expect(spies.hashToken).toHaveBeenCalledWith('raw-token');
  expect(mocks.familyMemberRepository.createInvite).toHaveBeenCalledWith({
    email: 'invitee@example.com',
    familyId: mocks.family.id,
    inviteExpiresAt: new Date('2026-10-11T12:00:00Z'),
    tokenHash: 'hashed-token',
  });
});

it('SHOULD return the raw token once, the expiry AND a PENDING MEMBER view without any token', async () => {
  const result = await setup.execute(mocks.input);

  expect(result.inviteToken).toBe('raw-token');
  expect(result.inviteExpiresAt).toEqual(new Date('2026-10-11T12:00:00Z'));
  expect(result.member).toMatchObject({
    email: 'invitee@example.com',
    inviteExpired: false,
    role: 'MEMBER',
    status: 'PENDING',
  });
  expect(JSON.stringify(result.member)).not.toContain('raw-token');
  expect(JSON.stringify(result.member)).not.toContain('hashed-token');
});

it('SHOULD throw ConflictException WHEN the email already has a row (pending or joined)', async () => {
  mocks.familyMemberRepository.findByEmail.mockResolvedValueOnce(mocks.createdMember);

  await expect(setup.execute(mocks.input)).rejects.toThrow(
    new ConflictException('FAMILY_MEMBER_ALREADY_EXISTS'),
  );
  expect(mocks.familyMemberRepository.createInvite).not.toHaveBeenCalled();
});

it('SHOULD throw ConflictException WHEN a concurrent invite wins the unique constraint', async () => {
  mocks.familyMemberRepository.createInvite.mockResolvedValueOnce(undefined);

  await expect(setup.execute(mocks.input)).rejects.toThrow(
    new ConflictException('FAMILY_MEMBER_ALREADY_EXISTS'),
  );
});

it.each([
  ['not an email', { email: 'nope' }],
  ['empty email', { email: '   ' }],
  ['255-char email', { email: `${'a'.repeat(246)}@test.com` }],
  ['empty familyId', { familyId: '' }],
])('SHOULD throw ValidationError (400) WHEN %s AND check nothing', async (_l, override) => {
  await expect(setup.execute({ ...mocks.input, ...override })).rejects.toThrow(ValidationError);
  expect(mocks.ensureFamilyOwnerUseCase.execute).not.toHaveBeenCalled();
});
