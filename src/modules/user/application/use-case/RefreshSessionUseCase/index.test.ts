import { UnauthorizedException } from '@nestjs/common';

import { RefreshSessionSchema } from '@user/application/dto/RefreshSession';

import { mocks, setup, throwableSetup } from './index.mocks';

function expectInvalidSession(error: unknown) {
  expect(error).toBeInstanceOf(UnauthorizedException);
  expect(error).toHaveProperty('message', 'Invalid or expired session');
  expect(mocks.jwtProvider.sign).not.toHaveBeenCalled();
  expect(mocks.sessionRepository.rotateSession).not.toHaveBeenCalled();
}

describe('GIVEN the current token of a live session', () => {
  it('SHOULD rotate (current → previous, previous → retired) AND return a new pair', async () => {
    const result = await setup('current');

    expect(mocks.sessionRepository.findSessionByTokenHash).toHaveBeenCalledWith('hash:current');
    expect(mocks.sessionRepository.rotateSession).toHaveBeenCalledWith(
      'hash:current',
      expect.objectContaining({
        previousTokenHash: 'hash:current',
        retiredTokenHash: 'hash:previous',
        tokenHash: 'hash:new-token',
      }),
    );
    expect(result).toEqual({
      refreshToken: 'new-token',
      refreshTokenExpiresIn: mocks.ttl,
      token: mocks.jwt,
    });
  });

  it('SHOULD sign the access token for the session user', async () => {
    const session = await mocks.sessionRepository.findSessionByTokenHash();

    await setup('current');

    expect(mocks.jwtProvider.sign).toHaveBeenCalledWith({ user: { id: session.userId } });
  });
});

describe('GIVEN the previous token AND the current one never presented (lost response)', () => {
  it('SHOULD issue a new current token AND keep previous/retired', async () => {
    const result = await setup('previous');

    expect(mocks.sessionRepository.rotateSession).toHaveBeenCalledWith(
      'hash:current',
      expect.objectContaining({
        previousTokenHash: 'hash:previous',
        retiredTokenHash: 'hash:retired',
        tokenHash: 'hash:new-token',
      }),
    );
    expect(result.refreshToken).toBe('new-token');
  });
});

describe('GIVEN invalid situations', () => {
  it('SHOULD answer 401 for an unknown token WITHOUT deleting anything', async () => {
    mocks.sessionRepository.findSessionByTokenHash.mockResolvedValueOnce(undefined);

    expectInvalidSession(await throwableSetup('garbage'));
    expect(mocks.sessionRepository.deleteSessionById).not.toHaveBeenCalled();
  });

  it('SHOULD delete AND answer 401 for an idle session (last used a TTL ago)', async () => {
    const idle = mocks.buildSession({ lastUsedAt: new Date(Date.now() - mocks.ttl * 1000 - 1000) });
    mocks.sessionRepository.findSessionByTokenHash.mockResolvedValueOnce(idle);

    expectInvalidSession(await throwableSetup('current'));
    expect(mocks.sessionRepository.deleteSessionById).toHaveBeenCalledWith(idle.id);
  });

  it('SHOULD delete AND answer 401 for a retired token (copied), killing the current one too', async () => {
    const session = await mocks.sessionRepository.findSessionByTokenHash();

    expectInvalidSession(await throwableSetup('retired'));
    expect(mocks.sessionRepository.deleteSessionById).toHaveBeenCalledWith(session.id);
  });

  it('SHOULD delete AND answer 401 WHEN the user no longer exists', async () => {
    mocks.userRepository.existsById.mockResolvedValueOnce(false);
    const session = await mocks.sessionRepository.findSessionByTokenHash();

    expectInvalidSession(await throwableSetup('current'));
    expect(mocks.sessionRepository.deleteSessionById).toHaveBeenCalledWith(session.id);
  });

  it('SHOULD answer 401 WITHOUT deleting WHEN rotateSession loses the race', async () => {
    mocks.sessionRepository.rotateSession.mockResolvedValueOnce(false);

    const error = await throwableSetup('current');

    expect(error).toBeInstanceOf(UnauthorizedException);
    expect(error).toHaveProperty('message', 'Invalid or expired session');
    expect(mocks.sessionRepository.deleteSessionById).not.toHaveBeenCalled();
    expect(mocks.jwtProvider.sign).not.toHaveBeenCalled();
  });
});

describe('GIVEN the input schema', () => {
  it('SHOULD reject an empty, huge or non-string refreshToken', () => {
    expect(RefreshSessionSchema.safeParse({ refreshToken: '' }).success).toBe(false);
    expect(RefreshSessionSchema.safeParse({ refreshToken: 'a'.repeat(513) }).success).toBe(false);
    expect(RefreshSessionSchema.safeParse({ refreshToken: 42 }).success).toBe(false);
    expect(RefreshSessionSchema.safeParse({}).success).toBe(false);
  });
});
